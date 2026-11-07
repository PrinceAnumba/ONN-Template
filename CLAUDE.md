# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phase 1 of the build is done: monorepo, country config, token generation and two minimal apps. `docs/onn-frontend-prompt.md` is the source of truth for scope, tokens, API contract, component specs, budgets and acceptance. Its numbers are requirements; use them as given, and read the relevant section before building a page or component rather than working from this summary.

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
pnpm --filter @onn/config exec vitest run -t "deriveInk"   # single test by name
```

Added in later phases: `pnpm mocks:gen --country=SEN --seed=42` (2), `pnpm storybook` (4), `pnpm e2e` and `pnpm lhci` (8).

Environment (`.env.example`, read from the repo root): `NEXT_PUBLIC_API_BASE` (empty = mocks), `NEXT_PUBLIC_COUNTRY` (picks config and fixtures), `NEXT_PUBLIC_SITE_URL`, `ADMIN_ORIGIN` (where the portal forwards `/admin`).

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
- **The frontend owns the API contract** in `packages/api-client/types.ts`; the backend implements it and MSW serves it until then. All calls go through one `apiFetch` wrapper (locale, 15 s timeout, one retry on network failure but not on 4xx, `Problem` parsed into `ApiError`).
- **Data fetching split.** Server Components fetch with `next: { revalidate: 300, tags: ["indicator:<code>"] }` so the backend's publish webhook can call `revalidateTag`. Client islands use TanStack Query (`staleTime` 5 min, `gcTime` 30 min).
- **No data in markup.** Every number on screen comes from the API client, with its source, reference year and a link to its metadata.
- **URL is the state for data views.** Typed with `nuqs`: `i`, `a`, `c`, `y`, `d`, `u`, `v`, `l`. Defaults are omitted, every combination survives reload and sharing, and invalid values fall back to defaults with a toast.
- **SSR first, hydrate later.** Public pages stay readable with JavaScript disabled. `ChartFrame` renders an SSR SVG (ECharts SSR) and hydrates near the viewport; `ChoroplethMap` uses `d3-geo` SVG on the server and MapLibre on the client, sharing classification code so colours match.
- **Lite mode** is stored in a cookie so the server can render it: no MapLibre, no chart hydration, no images except logos, tables before charts.
- **Mocks are stateful for admin.** An in-memory store lets the workflow be clicked end to end: a value published in admin must appear on the portal mock. Every page shows the `DemoRibbon` when mocks are on.
- **Admin roles.** Hide what a role cannot do rather than disabling it. Disable with a tooltip only when the rule depends on data (e.g. approving your own submission).

## Conventions enforced by tooling

- CSS Modules + custom properties from tokens; no runtime CSS-in-JS. No dark mode in v1. Use logical properties (`margin-inline-start`) so RTL works.
- ESLint forbids string literals in JSX text and in `aria-label`, `title`, `alt` and `placeholder`: all UI text goes through `next-intl` ICU messages, and translated fragments are never concatenated. A test fails on any missing message.
- Every component lives in `packages/ui` or `packages/charts`, with a Storybook story covering default, loading, empty, error, long text, RTL and mobile, plus a Playwright/axe check.
- Keep MapLibre, ECharts modules, KaTeX, Tiptap and Scalar code-split and out of the home bundle. CI fails on budget overruns (§9), e.g. home first-load JS ≤ 170 KB gzipped.

## Design rules (§2)

- Use tokens only; no hard-coded colours, spacing, radii, shadows or durations in components.
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

## Testing and done (§10)

Layers: Vitest unit, Testing Library + Storybook interaction, Playwright e2e (Chromium, WebKit, Pixel 5) with axe, visual regression at 360/768/1280px, Lighthouse CI. The project is done only when all 10 journeys and every "Done when" item in §10 pass.

## Spec decisions

These resolve contradictions and gaps in the brief. Follow them over the brief's wording, and don't re-open them without asking.

- **Mocks:** one standalone mock server reuses the MSW handlers and holds the shared store for both apps, and calls each app's `revalidateTag` on publish. In-memory browser/Node MSW can't share state across apps, and its browser worker would compete with Serwist for the service-worker scope. MSW stays for unit tests and Storybook.
- **Chart contrast:** keep the Okabe-Ito palette, draw charts on white only (`#CC79A7` and `--onn-compare` fall below 3:1 on `--onn-surface-2`), and give `#E69F00`, `#56B4E9` and `#F0E442` a darker outline or direct labels because they fail 3:1 on white.
- **Primary buttons:** always use `--onn-primary-ink` as the background. It equals `--onn-primary` when that already reaches 4.5:1 with white, so no extra token is needed.
- **At risk pill:** `#B26A00` is 4.24:1 on white, so use it as the background or border with `--onn-ink` text.
- **Contract and config gaps:** add what the brief's screens need but its types omit (`fallback`, `Pillar` description, indicator synonyms, source and international fields on summaries, catalogue filters, `latest` status, sparkline data, `/home`, `/index` and `/targets` responses, multi-year benchmark, admin types, plus config keys for data protection law and authority, social links and SSO name). Record each one as a contract change for the backend team.
- **Admin routing:** serve admin under `/admin` with Next.js multi-zones, with its locale in a cookie rather than the path.
- **Lite mode:** on first visit use the `Save-Data` request header, then the cookie. `navigator.connection` and Background Sync aren't available in WebKit, so queued forms also retry on page load.
- **Wolof formatting:** set a tested fallback locale for numbers and dates in case `Intl` data for `wo` is missing.
- **Unspecified routes:** `/embed/chart`, `catalog.jsonld` and the RSS feed get minimal definitions when their pages are built.
- **Missing assets:** official boundaries, logos, brand colours, reviewed Wolof strings and TGO config use visibly marked placeholders until supplied.
