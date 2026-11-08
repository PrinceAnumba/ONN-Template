# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phases 1 to 4 of the build are done: monorepo, country config, tokens, API client, mock server, app shells with selector bar and URL state, and the §6 components and charts with Storybook. Phase 5 has built home, the data explorer (area profile), the indicator page with its `/embed/chart` view, the map, dashboards with presentation mode, benchmark and the data query tool. The other public pages and the admin screens are still placeholders.

Sections below describe the system the brief specifies, so parts of it don't exist yet. As each phase lands, check this file against the code and replace anything that has drifted.

## Build phases

Work one phase per message and commit after each phase. Don't start the next phase in the same message.

1. Monorepo, config and tokens (§1–2)
2. API types, mocks and fixtures (§3)
3. App shell and selector bar (§4)
4. Components and charts, with Storybook (§6)
5. Public pages, one or two at a time, with a commit after each batch (§5)
6. States, offline mode, i18n and Lite mode (§8–9)
7. Back-office screens (§7)
8. Tests and Lighthouse budgets (§10)

Budgets are enforced in phase 8, so report bundle sizes at the end of phases 4 and 5 to catch overruns early.

## What this is

A reusable, country-agnostic National Digital Observatory (ONN): a public data portal and a back-office UI, built as two Next.js apps sharing one design system. Frontend only. The backend is another team's, so the frontend must run fully against mocks and switch to the real API by changing one environment variable. UX patterns come from ITU DataHub, without its brand.

Out of scope: real authentication (mock the session; OIDC through Auth.js config only), server-side data processing, PDF/PPTX generation (call the export endpoints and handle the download), sending email/SMS.

## Commands

```
pnpm dev                                  # both apps: portal :3000, admin :3001
pnpm dev:portal                           # portal only
pnpm build
pnpm test                                 # Vitest
pnpm lint
pnpm typecheck
pnpm format
pnpm mocks:gen --country=SEN --seed=42    # rewrite fixtures deterministically
pnpm --filter @onn/portal exec vitest run url-state   # one test file
pnpm storybook                            # :6006
pnpm build-storybook
pnpm check:stories                        # every §6 component has every state
```

Story interaction and axe tests: serve `apps/storybook/storybook-static` on :6006 (e.g. `npx http-server storybook-static -p 6006`), then run `pnpm --filter @onn/storybook test-storybook --url http://localhost:6006`. Added in Phase 8: `pnpm e2e` and `pnpm lhci`.

Environment (`.env.example`, read from the repo root): `NEXT_PUBLIC_API_BASE` (empty = mocks), `NEXT_PUBLIC_COUNTRY` (picks config and fixtures), `NEXT_PUBLIC_SITE_URL`, `ADMIN_ORIGIN` (where the portal forwards `/admin`), `MOCK_API_ORIGIN`, `MOCK_PORT`, `MOCK_LATENCY` (`0` turns off the delay).

Versions are pinned on purpose: Next 15 (brief), TypeScript 5.9 (`typescript-eslint` doesn't support 7) and ESLint 9 (`eslint-plugin-jsx-a11y` doesn't support 10). pnpm blocks install scripts unless listed under `allowBuilds` in `pnpm-workspace.yaml`.

## Architecture

pnpm workspaces + Turborepo; Next.js 15 App Router, React 19, strict TypeScript.

```
apps/portal          public portal
apps/admin           back-office UI
packages/ui          design-system components + tokens.css
packages/charts      ECharts and map wrappers
packages/config      country.config.ts, Zod schema, token generator
packages/api-client  typed client + contract types, TanStack Query hooks
packages/mocks       MSW handlers + fixtures per country (fixtures/SEN, fixtures/TGO)
packages/i18n        shared message catalogues
```

Design decisions that span packages:

- **Country config drives everything.** Names, colours, languages, maps, institutions and peer groups come from `packages/config/countries/{ISO3}.ts`. No country string appears in a component; swapping `SEN` for `TGO` must require zero component edits.
- **`generate.ts` runs first.** As `@onn/config`'s `build` (a `^build` dependency of every task), it validates the active country with Zod, so a missing key fails the build. It then writes `packages/config/generated/country.json`, `packages/ui/tokens.css` and `apps/*/public/brand`, all gitignored. Apps import `country` from `@onn/config`, which reads the generated JSON, so bundles carry one country and no Zod. Import `@onn/config/schema` only in build code.
- **Tokens are generated.** `packages/config/tokens.ts` builds `tokens.css` from `brand`, deriving `--onn-primary-ink` in OKLCH to reach 4.5:1 on white. Don't edit `tokens.css` by hand.
- **Two zones, one domain.** The portal rewrites `/admin` to `ADMIN_ORIGIN`; the admin app has `basePath: "/admin"`, so its own routes don't repeat the prefix.
- **Fonts.** Source Sans 3 lives in `packages/ui/fonts` as separate Latin and Latin Extended families in one font stack, so Latin Extended downloads only when a glyph needs it. Next's font preload manifest is empty on Windows builds (its plugin matches a forward-slash path), so check preload on a Linux build.
- **The frontend owns the API contract** in `packages/api-client/types.ts`; the backend implements it and the mock server serves it until then. Any change to the brief's contract goes in `docs/api-contract-changes.md`. All calls go through one `apiFetch` wrapper (locale, 15 s timeout, one retry on network failure but not on 4xx, `Problem` parsed into `ApiError`).
- **Data fetching split.** Server Components fetch with `next: { revalidate: 300, tags: ["indicator:<code>"] }` so the backend's publish webhook can call `revalidateTag`. Client islands use TanStack Query (`staleTime` 5 min, `gcTime` 30 min).
- **No data in markup.** Every number on screen comes from the API client, with its source, reference year and a link to its metadata.
- **URL is the state for data views.** Typed with `nuqs`: `i`, `a`, `c`, `y`, `d`, `u`, `v`, `l`. Defaults are omitted, every combination survives reload and sharing, and invalid values fall back to defaults with a toast.
- **SSR first, hydrate later.** Public pages stay readable with JavaScript disabled. `ChartFrame` renders an SSR SVG (ECharts SSR) and hydrates near the viewport; `ChoroplethMap` uses `d3-geo` SVG on the server and MapLibre on the client, sharing classification code so colours match.
- **Lite mode** is stored in a cookie so the server can render it: no MapLibre, no chart hydration, no images except logos, tables before charts.
- **Mock server.** `pnpm dev` starts `packages/mocks/server.ts` on :4000. Server code calls it directly; the browser uses relative `/api/v1` and `/geo` paths that both apps rewrite to it. Fixtures in `packages/mocks/fixtures/{ISO3}` are generated and committed, so change `catalog.ts`, `geography.ts` or `fixtures.ts` and regenerate rather than editing them. Stored text is `{fr, en}`, and the handlers pick the language and set `fallback`, so add new text in that form. Boundaries come from `packages/mocks/boundaries/{ISO3}`: geoBoundaries stand-ins written by `pnpm --filter @onn/mocks boundaries --country=SEN`, which matches shape names to `geography.ts` and fails on any mismatch. There are no adm3 areas yet, and XLSX downloads return 501. After regenerating fixtures, delete `apps/portal/.next/cache/fetch-cache` or the running portal keeps serving old data.
- **Mocks are stateful for admin.** An in-memory store lets the workflow be clicked end to end: a value published in admin must appear on the portal mock. Every page shows the `DemoRibbon` when mocks are on.
- **Admin roles.** Hide what a role cannot do rather than disabling it. Disable with a tooltip only when the rule depends on data (e.g. approving your own submission).

## Conventions enforced by tooling

- Tailwind v4 utilities and shadcn components; no runtime CSS-in-JS. No dark mode in v1. Use logical utilities (`ms-*`, `ps-*`, `text-start`) so RTL works.
- ESLint forbids string literals in JSX text and in `aria-label`, `title`, `alt` and `placeholder`: all UI text goes through `next-intl` ICU messages, and translated fragments are never concatenated. A test fails on any missing message.
- Every component lives in `packages/ui` or `packages/charts`, with a Storybook story covering default, loading, empty, error, long text, RTL and mobile, plus a Playwright/axe check.
- Keep MapLibre, ECharts modules, KaTeX, Tiptap and Scalar code-split and out of the home bundle. CI fails on budget overruns (§9), e.g. home first-load JS ≤ 170 KB gzipped.

## Design rules (§2)

- Use tokens only; no hard-coded colours, spacing, radii, shadows or durations in components. `packages/ui/base.css` maps tokens to Tailwind utilities (`bg-primary`, `text-h2`, `bg-cat-1`, `rounded-pill`) and to shadcn's variable names. Tailwind's default colours are removed, so `bg-red-500` compiles to nothing; don't use arbitrary values to get around that.
- Type scale, 12-column grid and breakpoints (640, 768, 1024, 1280) are fixed in §2. Container max is 1280px, gutters 24px (16px under 640px).
- Chart colour roles: focus = `--onn-primary`; comparison = `--onn-compare` dashed 2px; peer band = primary at 12% opacity; categorical = Okabe-Ito in the §2 order; no-data = 45° grey hatch; map = 5 sequential steps.

## Data display (§4.4, §6)

- Every number goes through `packages/ui/format.ts`; null renders "—". Periods and number spacing follow the locale.
- Status flags (E/P/B) stay visible wherever the value appears.
- KPI values never count up.
- Change colours respect `higherIsBetter`, and a change within ±0.5% is grey.

## Chart rules (§6)

- Y axis starts at 0 for counts and percentages unless the range is under 10% of max. Gridlines are horizontal only.
- Bars go horizontal when labels are long or there are more than 8 items. Donuts have at most 6 slices, with the rest grouped as "Other". Stacked bars are only for parts of a whole.
- Every chart has a generated `aria-label` summary and a visually hidden table.
- CSV exports contain exactly what is plotted; PNG exports are 2× with title, source and logo baked in.

## UI states (§8)

- Skeletons match final dimensions exactly, with no layout shift.
- Client refetches keep old data visible with a progress line; don't swap back to a skeleton.
- Errors stay inside the widget, so one failure never blanks a dashboard.
- Motion uses only the duration and easing tokens, and is removed or reduced to opacity under `prefers-reduced-motion` and in Lite mode.
- Admin never serves cached submission data; only entry-grid drafts work offline.

## Accessibility (§9)

WCAG 2.2 AA: one h1 per page, skip link, `--onn-focus` on every interactive element, touch targets ≥ 44 × 44 px, contrast ≥ 4.5:1 for text and 3:1 for UI and chart marks. All data is reachable without a mouse (map list view, chart table view). Filter changes are announced in a live region. Forms use visible labels and linked inline errors, plus an error summary on submit. Text zooms to 200% with no horizontal scroll at 320px.

## Performance (§9)

- Target device: Android Go, 360 × 640, 2 GB RAM, Slow 4G/3G.
- Key budgets: LCP < 2.5 s, CLS < 0.1, INP < 200 ms; first-load JS ≤ 170 KB (home), ≤ 230 KB (indicator); map JS after interaction ≤ 320 KB; home transfer ≤ 900 KB; fonts ≤ 2 files and ≤ 90 KB; adm1 TopoJSON ≤ 150 KB; Lighthouse ≥ 90 / 100 / 100 / 100.

## Charts and maps

- **Charts are data.** A chart is a serialisable `ChartSpec` (`packages/charts/spec.ts`). `buildOption()` turns it into an ECharts option on the server (`ssr.ts`, SVG at 800 and 360 px wide) and again on the client, because ECharts formatters are functions and can't cross the server/client boundary. Never put a function in a spec.
- `Chart` (server-safe) renders both SVGs and hands them to `ChartFrame` (client), which hydrates within 200 px of the viewport and loads one runtime from `runtime/` per chart kind. Lite mode passes `lite` and never hydrates.
- `chartTable()` is the single source for the hidden table, "View as table" and CSV export, so they always match the plot.
- Colours for ECharts, MapLibre and PNG export come from `@onn/config/tokens` (generated). The three Okabe-Ito colours under 3:1 get `categoricalBorder` outlines.
- Maps use `choropleth()` for classes and fills, shared by `ChoroplethSvg` (static server SVG, home teaser), `ChoroplethInteractive` (the default map) and `ChoroplethMap` (MapLibre, lazy), so colours always match.
- The interactive map never ships d3-geo or TopoJSON: `projectShapes()` (`map-shapes.ts`) projects boundaries to SVG paths on the server, and `lib/map-view.ts` sends every year of values for the level, so the year slider and play button recolour on the client. Level changes (`l`) re-render on the server. The raw topology is sent only when `features.basemap` is on, for MapLibre.
- `MapExplorer` (`apps/portal/components/map`) is both the `/map` page (`layout="overlay"`) and the indicator page map view (`layout="stacked"`, loaded through `MapExplorerLazy`). Year, list view and selection are client state; `y` and `v=table` sync to the URL only on `/map`. Region breakdowns are hidden when an area has none (the mock has national breakdowns only).
- MapLibre's worker isn't bundled: `@onn/charts` `build` copies it to `apps/*/public/vendor/maplibre`. Pass `workerUrl` with the basePath in the admin app.
- Dashboards: `lib/dashboard.ts` turns each widget into plain data (chart spec, KPI or target props, map shapes, table rows) and catches each failure as an error model. `WidgetShell` (`packages/ui`) gives every widget its title, ⋮ menu and "View data" table; charts inside use `Chart` with `bare`, which drops the frame's own header. Widgets without their own area or comparison use the selector's `a` and `c`.
- Benchmark: peer group tabs are links that set `c=peer:GROUP` (the default group stays out of the URL), and the focus is always the configured country. The rank slope chart is a `LineSpec` with `rank: true` (inverted axis from 1, whole steps).
- Data query: the builder is client state until "Apply filters" pushes `i`, `a` (a comma list on this page only) and `y`; the server then renders the first 100 rows, so the preview works without JavaScript and isn't virtualised (`DataTable` virtualises above 200 rows). The API URL and snippets fall back to the request origin when `NEXT_PUBLIC_SITE_URL` is unset, so they stay absolute. `DataDownloadMenu` is shared with the indicator toolbar.
- Presentation mode loads on demand and redraws charts with `buildOption(..., { dark: true })`. The slide is `?p=` (1-based). `PresentButton` calls `requestFullscreen` inside the click handler, because browsers refuse it later; a `?p=` link opens the overlay without fullscreen.
- `packages/ui/base.css` has `@source "../charts"`; without it, chart classes aren't generated in the apps.
- `packages/ui` and `packages/charts` stay free of next-intl: components take translated labels as props.

## Accessibility lessons from the story tests

- Use `useRestoreFocus(open)` from `@onn/ui/lib/use-restore-focus` as `onCloseAutoFocus` on any controlled Radix dialog. Radix alone returned focus to `<body>`.
- Scrollable regions (drawer bodies, tables) need `tabIndex={0}`.
- Never hide a label with `invisible`: it leaves the accessible name. Use `opacity-0`.
- Anything with `position: absolute` (including `sr-only` text) inside a horizontal scroller needs a positioned ancestor inside the scroller, or it escapes the clip and widens the page; phones then zoom out. KpiCard is `relative` for this.
- Never put `sr-only` on a `<table>`: tables size to their cells, so the clipped table still widens the page on mobile. Put `sr-only` on a wrapping `div` (as `ChartFrame` does).
- Grid children default to `min-width: auto`, so a wide table or chart stretches its column; dashboard widgets are `min-w-0`.
- An open `listbox` must contain options; put empty-state text outside it in a `role="status"`.

## Keeping bundles small

Trust measured downloads over the build table: at Phase 3 `next build` reported 115 KB for a home page that really downloaded 159 KB.

Measured gzipped JS at Phase 4: home 146 KB, data routes 161 KB. At Phase 5c: home 154 KB, `/data` profile 172 KB, indicator page 221 KB before ECharts (421 KB once the chart hydrates), `/map` 192 KB on first load and 217 KB after opening a panel and the list view (map budget 320 KB). At Phase 5d: dashboard pages 209 KB first load; home 156 KB. At Phase 5e: benchmark 181 KB, query 200 KB. Third-party code measured with esbuild:

| Code                                                            | Gzipped |
| --------------------------------------------------------------- | ------- |
| ECharts core + SVG renderer                                     | 101 KB  |
| + line + grid (smallest usable line chart)                      | 150 KB  |
| Current line runtime (+ tooltip, legend, markLine, labelLayout) | 173 KB  |
| MapLibre client chunk (plus its worker)                         | 293 KB  |

So the indicator budget (230 KB with ECharts) and map budget (320 KB with MapLibre) can't be met as specified. The user decided how to handle both; see Spec decisions.

- If `next build` fails with a missing `vendor-chunks/*` module after dependency changes, delete `apps/*/.next` (stale cache).

- Don't use a route group with a client layout (a `(data)/layout.tsx`). Next merges its client code into the parent layout, so it reaches every page. Each selector route has a one-line `layout.tsx` exporting `DataShell` instead.
- Use `Link` from `@/i18n/navigation`, which turns prefetch off.
- A client component imported by a page ships with that page even when it isn't rendered for the current URL. For a view that appears only sometimes (the indicator page map view), import it through a small `"use client"` wrapper that calls `next/dynamic`; it still server-renders.
- Client islands that need extra message namespaces wrap themselves in `ClientMessages` (`components/shell/client-messages.tsx`). It repeats the shared `CLIENT_NAMESPACES` because a nested provider replaces its parent's messages.
- Load anything opened on demand with `next/dynamic`, mounted on first use: the palette (cmdk, TanStack Query), mobile menu and selector sheet (Radix Dialog).
- `Combobox` and `Toast` are hand-built with no dependencies, because `cmdk` isn't the APG pattern §6 asks for and both load on data routes.

## Routing pitfalls

- Site pages live in `app/[locale]/(site)`, whose server layout adds header, footer and skip link. `app/[locale]/embed` sits outside it so embeds have no chrome. A server-only route-group layout is fine; the pitfall below is about client layouts.
- Indicator codes contain dots (`CONN.4G_POP`), so the middleware matcher must list file extensions, not skip every path with a dot.
- Radix focuses the first field when a sheet opens, and `Combobox` opens on focus. A sheet containing one must set `onOpenAutoFocus` so the list doesn't cover it.
- Check new header or top-bar controls against the corner `DemoRibbon`, which reserves inline-end padding there.

## Testing and done (§10)

Layers: Vitest unit, Testing Library + Storybook interaction, Playwright e2e (Chromium, WebKit, Pixel 5) with axe, visual regression at 360/768/1280px, Lighthouse CI. The project is done only when all 10 journeys and every "Done when" item in §10 pass.

## Spec decisions

These resolve contradictions and gaps in the brief. Follow them over the brief's wording, and don't re-open them without asking.

- **Styling:** the user chose Tailwind and shadcn over the brief's CSS Modules. Token values, the §6 component specs and the budgets are unchanged, so a shadcn component is a starting point: edit it until it matches §6 (`Button` still needs the 36/44/48px sizes, the spec's variants and `--onn-focus`; `Combobox` must meet the APG behaviour). Check each new component's client JS against the budgets.
- **Adding shadcn components:** run `pnpm dlx shadcn@latest add <name>` from `packages/ui`, then replace `from "cn"` with `from "@onn/ui/lib/utils"` because the CLI leaves that import unresolved. Keep `optimizePackageImports: ["radix-ui"]` in both Next configs; without it one Button adds 80 KB.

- **Mocks:** one standalone mock server reuses the MSW handlers and holds the shared store for both apps, and calls each app's `revalidateTag` on publish. In-memory browser/Node MSW can't share state across apps, and its browser worker would compete with Serwist for the service-worker scope. MSW stays for unit tests and Storybook.
- **Chart contrast:** keep the Okabe-Ito palette, draw charts on white only (`#CC79A7` and `--onn-compare` fall below 3:1 on `--onn-surface-2`), and give `#E69F00`, `#56B4E9` and `#F0E442` a darker outline or direct labels because they fail 3:1 on white.
- **Ink contrast:** `--onn-primary-ink` is derived against `--onn-surface-2`, not white as the brief says, because text on the grey hero failed (SEN #00853F is 4.42:1 there). Passing on surface-2 also passes on white.
- **Map boundaries:** region outlines use `--onn-compare`, because the lowest map class equals `--onn-surface-2` and vanished on grey cards. The brief's colour scale itself is unchanged; the user was told it is under 3:1.
- **Map geometry winding:** `toFeatures()` rewinds polygons for d3-geo, which reads a counter-clockwise ring as the whole globe minus the shape. Keep it: official boundary files come in either winding.
- **Primary buttons:** always use `--onn-primary-ink` as the background. It equals `--onn-primary` when that already reaches 4.5:1 with white, so no extra token is needed.
- **At risk pill:** `#B26A00` is 4.24:1 on white, so use it as the background or border with `--onn-ink` text.
- **Contract and config gaps:** add what the brief's screens need but its types omit (`fallback`, `Pillar` description, indicator synonyms, source and international fields on summaries, catalogue filters, `latest` status, sparkline data, `/home`, `/index` and `/targets` responses, multi-year benchmark, admin types, plus config keys for data protection law and authority, social links, SSO name and boundary credit). Record each one as a contract change for the backend team.
- **Chart budget:** the user chose to keep ECharts. First-load JS is measured up to when the page is usable; the server SVG is on screen before ECharts loads near the viewport. Never import ECharts into a page's initial bundle.
- **Map:** the user chose an interactive SVG map by default (d3-geo, the same SVG as the no-JS view). MapLibre loads only when `features.basemap` is on, behind a "Show basemap" toggle with OSM raster tiles; check the OSM tile usage policy, or set a tile provider, before enabling it in production. The selected outline gets a light halo because the darkest class shares the `--onn-primary-ink` colour. Classification and "Show labels" aren't in the URL, because §4.4 lists no parameter for them.
- **Home stays light:** sections are Server Components, the hero selector has no URL state, benchmark bars are HTML and thumbnails are server SVG. Home has about 24 KB of budget left after the Phase 3 shell.
- **Admin routing:** serve admin under `/admin` with Next.js multi-zones, with its locale in a cookie rather than the path.
- **Admin role access:** the brief doesn't say which role sees which section, so `apps/admin/lib/sections.ts` holds an assumed mapping that the user should confirm.
- **Lite mode:** on first visit use the `Save-Data` request header, then the cookie. `navigator.connection` and Background Sync aren't available in WebKit, so queued forms also retry on page load.
- **Wolof formatting:** set a tested fallback locale for numbers and dates in case `Intl` data for `wo` is missing.
- **Unspecified routes:** `catalog.jsonld` and the RSS feed get minimal definitions when their pages are built. `/embed/chart` takes the indicator page URL state (`i` plus `a c y d u`) and renders one chart with a link back.
- **Indicator page state:** toolbar changes (`u`, `d`, `y`) and the selector go through nuqs with `shallow: false`, so the server re-renders the page; `startTransition` keeps the old content under a progress line. View tabs are plain links so they work without JS. The disaggregated view drops the comparison series. The table puts the latest period first at every width (the brief asks for it on mobile only). The map view reuses the map page explorer.
- **Boundaries:** the user chose geoBoundaries as a stand-in until ANSD and INSEED supply official files. Every map shows the config `geography.boundaries` credit with a "not official boundaries" note. Togo's files are share-alike (ODbL, CC BY-SA). The mock area lists follow the files (no Keur Massar; Togo has 37 prefectures).
- **Missing assets:** official boundaries, logos, brand colours, reviewed Wolof strings and TGO config use visibly marked placeholders until supplied.
