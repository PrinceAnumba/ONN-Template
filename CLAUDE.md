# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phases 1 to 4 of the build are done: monorepo, country config, tokens, API client, mock server, app shells with selector bar and URL state, and the §6 components and charts with Storybook. Phase 5 is done: every public page in §5, including news with its RSS feed, open data with `catalog.jsonld`, developers, feedback, and the CMS-driven about and legal pages. Phase 6 runs in batches: 6a (loading, error and empty states), 6b (Lite mode and motion), 6c (i18n), 6d (offline) and 6e (SEO) are done, which completes Phase 6. Phase 7 runs in batches: 7a (shell, sign-in, admin contract and mock store, dashboard), 7b (submissions, workflow, calendar, publish to portal), 7c (import wizard, data entry), 7d (connectors, quality, indicators), 7e (dashboard builder, publications, reports), 7f (news and watch queue, pages and home modules, alerts, newsletter) and 7g (users, organisations, feedback, audit log, settings) are done, which completes Phase 7. Phase 8 (tests and budgets) is in place: the ten §10 journeys and a 320px reflow check pass on Chromium, WebKit and Pixel 5; visual regression covers every story; `budgets.mjs`, Lighthouse CI and `.github/workflows/ci.yml` (including a TGO build and smoke) exist; `README.md` is written. Still failing and awaiting the user's decision: home first-load JS 174 KB (budget 170) and indicator 247 KB (230); Lighthouse performance 0.77–0.95 (blocking time, `/map` LCP about 3.3 s, measured locally on Windows); an intermittent React #418 hydration error on `/map` seen only under Lighthouse. Linux visual baselines aren't committed yet (README, "Visual baselines"). The only placeholder left in the admin is `/profile` (MFA settings).

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

Story interaction and axe tests: serve the Storybook build with `node e2e/visual/serve.mjs` (:6006), then run `pnpm --filter @onn/storybook test-storybook --url http://localhost:6006`.

End-to-end (package `e2e`, against production builds, so `pnpm build` first):

```
pnpm e2e                                  # §10 journeys: chromium, webkit, pixel5; starts or reuses mock, portal, admin
pnpm --filter @onn/e2e exec playwright test admin --project=chromium   # one spec, one project
pnpm visual                               # every story at 360/768/1280 (needs pnpm build-storybook)
pnpm budgets                              # §9 budgets; needs mock + portal running
pnpm lhci                                 # Lighthouse CI; needs mock + portal running
```

Environment (`.env.example`, read from the repo root): `NEXT_PUBLIC_API_BASE` (empty = mocks), `NEXT_PUBLIC_COUNTRY` (picks config and fixtures), `NEXT_PUBLIC_SITE_URL`, `ADMIN_ORIGIN` (where the portal forwards `/admin`), `MOCK_API_ORIGIN`, `MOCK_PORT`, `MOCK_LATENCY` (`0` turns off the delay), `REVALIDATE_SECRET` (checked by the portal's `/api/revalidate`) and `REVALIDATE_URLS` (where the mock posts on publish).

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
- **Lite mode** is stored in a cookie (`onn-lite`, `1` or `0`) so the server can render it: no MapLibre, no chart hydration, no images except logos, tables before charts. Server code reads it with `isLite()` (`lib/lite.ts`, cached per request), so components call it directly instead of taking a prop. `ChartFrame` with `lite` puts its table first and always visible; `loadMapData` drops the topology, so the basemap toggle disappears; CMS images become their alt text. The footer `LiteToggle` is a form that posts to `/[locale]/lite` without JavaScript; with it, it sets the cookie and refreshes, and turns Lite on for a slow `navigator.connection` when there is no cookie yet. `<html data-lite>` drives the CSS.
- **Mock server.** `pnpm dev` starts `packages/mocks/server.ts` on :4000. Server code calls it directly; the browser uses relative `/api/v1` and `/geo` paths that both apps rewrite to it. Fixtures in `packages/mocks/fixtures/{ISO3}` are generated and committed, so change `catalog.ts`, `geography.ts` or `fixtures.ts` and regenerate rather than editing them. Stored text is `{fr, en}`, and the handlers pick the language and set `fallback`, so add new text in that form. Boundaries come from `packages/mocks/boundaries/{ISO3}`: geoBoundaries stand-ins written by `pnpm --filter @onn/mocks boundaries --country=SEN`, which matches shape names to `geography.ts` and fails on any mismatch. There are no adm3 areas yet, and XLSX downloads return 501. After regenerating fixtures, delete `apps/portal/.next/cache/fetch-cache` or the running portal keeps serving old data.
- **Mocks are stateful for admin.** An in-memory store lets the workflow be clicked end to end: a value published in admin must appear on the portal mock. Every page shows the `DemoRibbon` when mocks are on. `packages/mocks/admin-seed.ts` builds the starting state from the country's fixtures at server start (organisations are the catalogue's data sources; six demo users, one per role plus a second admin), so restarting the mock resets it; `admin.ts` serves `/admin/*`. Public feedback is stored there for the admin inbox.
- **Admin session.** The session cookie (`onn-session`, httpOnly, path `/admin`) holds the bearer token; `lib/session.ts` resolves it with `GET /admin/me` once per request, and `(app)/layout.tsx` redirects to `/login` without it. Sign-in is a form POST to `login/sso/route.ts` (a full redirect, as an identity provider's will be; a Server Action redirect from `/login` to `/login?step=mfa` lost the page title), then the MFA code through a Server Action (any six digits except `000000`). Against a real API the SSO step shows its error until Auth.js is configured. The profile menu's demo user list replaces the role switcher when mocks are on.
- **Admin access checks** run in `(app)/layout.tsx` with the path from `middleware.ts` (`x-onn-path`), because `loading.tsx` streams the page and a `notFound()` there would answer 200. Unknown paths and sections the role can't reach both answer 404; add screens outside the sidebar to `PLANNED` in `lib/sections.ts`. A Server Action posted from `/login` renders its redirect under that path, so `/login` is skipped.
- **Submission workflow.** `packages/mocks/admin-submissions.ts` holds the quality rules and applies published rows to the public observations (a period past an indicator's coverage extends `coverage.to`, or the portal's year range would stop short of it); `admin.ts` checks each transition and answers refusals with a `Problem` `type` (`role`, `scope`, `state`, `own-submission`, `errors`, `unjustified`, `comment`) that the admin maps to `Admin.submissions.refused.*`. On publish the mock calls `onPublished(tags)`, which posts to each `REVALIDATE_URLS` entry; the portal's `app/api/revalidate/route.ts` checks `X-Revalidate-Secret` and calls `revalidateTag`. A value published in admin shows on the portal on the next request. Restarting the mock resets it. `apps/admin/lib/submissions.ts` mirrors which status accepts which action, so the action bar shows only buttons that would work. "Approve" on your own submission stays visible with `aria-disabled` and the reason beside it (a data-dependent rule).
- **Admin list screens** (submissions first; later batches follow it): status tabs and filters are links and a GET form, so they work without JavaScript; the form's `action` needs the `/admin` basePath, `Link` doesn't. `DataTable` takes `selection` for checkboxes, `BulkActionBar` appears while rows are selected, `Pagination` with `PageSizeLinks` (25/50/100), `EmptyState` when nothing matches. After a bulk action, focus moves to the table because the bar hides. Bulk endpoints answer per id. Detail tabs are `?tab=` links. The calendar shows the month grid from `md` up and the list on phones.
- **Client calls from the admin** go through `app/bff/[...path]/route.ts` (`/admin/bff/*` → `/api/v1/admin/*`), which adds the bearer token from the httpOnly session cookie, refuses cross-origin writes and never caches. `lib/bff.ts` has `bff()` and `uploadForm()` (XHR, for upload progress). Server Components keep calling `adminApi` directly.
- **Import wizard.** `/imports/new` uploads (organisation, template, `FileDrop`), then `/imports/[id]` runs Map → Validate → Submit from the job's `status`, polling while the server parses or validates, so a reload resumes it. Fixes and row removals go to `PATCH …/rows`; the error report CSV is built in the browser. Mock parsing (`packages/mocks/admin-intake.ts`) reads CSV, JSON and XML; XLSX fails with `unsupported` until the backend reads it. With mocks on, the upload step offers a demo file with the five seeded errors from §10.
- **Entry grid.** `/entry/[indicator]?period=` renders `EntryGrid` (`packages/ui`) through `components/entry/entry-editor.tsx`: values save to an entry draft (an ordinary submission, so "Submit for verification" is the 7b transition) every 10 s, and every edit is also written to IndexedDB (`lib/drafts.ts`), so changes made offline come back when the page is next opened. Inline checks use `@onn/api-client/quality`, which the mock also uses. An empty cell is an error only when it clears a published value. Entry drafts link back to the grid from the submission page.
- **Connectors** (`/connectors`, `/connectors/new`, `/connectors/[id]`): one client form (`components/connectors/connector-form.tsx`) for settings, "Test connection" (which works on unsaved settings and returns the source fields with a suggested mapping), field mapping onto the import wizard's fields, "Dry run" (first 50 rows, unsaved mapping allowed) and "Run now" (needs the changes saved; shown with `aria-disabled` and the reason). Run history is server-rendered with `<details>` logs. Schedules are cron; `lib/cron-text.ts` puts them into words and the next run with `Intl` (`@onn/api-client/cron` parses for both sides). In the mock (`packages/mocks/admin-referential.ts`) the second seeded connector's endpoint answers 503 until it's changed, and a run creates a `connector` submission.
- **Quality** (`/quality`) uses `Chart` from `@onn/charts` (the admin depends on it now; labels from `lib/chart-labels.ts`). Pass rates come from `qualityStats()` in the mock, shared with the dashboard card so the two agree. The month line starts at the first month with data: ECharts animates the end label from the first point, and a leading gap gave it a NaN position.
- **Indicator referential** (`/indicators`, `/indicators/new`, `/indicators/[code]?tab=`): the editor (`components/indicators/indicator-editor.tsx`) keeps one draft across eleven APG tabs (arrow keys, `?tab=` via `history.replaceState`), marks tabs with changes or errors, and saves through a dialog that requires a version note. Admin indicator text is `Localised` (every locale), not resolved. Server errors come back as field paths; `tabOfPath()` (`lib/indicators.ts`) finds the tab and the summary links focus the field. Saving writes the public catalogue entry in the mock and revalidates the portal. Read-only roles get the same view in a disabled `fieldset` (the language switcher on _Definition_ sits outside it).
- **Restricted screens.** A screen inside a section that needs more than the section's roles (`/connectors/new`, `/indicators/new`) goes in `RESTRICTED` in `lib/sections.ts`, so it answers 404 from the layout; a `notFound()` in the page would answer 200 after streaming.
- **Field errors from the BFF.** `BffError.errors` carries a 422 Problem's `errors[]`; forms map paths to fields, show an `ErrorSummary`-style list that takes focus, and wire each message with `aria-describedby`.
- **Content screens** (7e) need `content.edit` and keep `Localised` text. `packages/mocks/admin-content.ts` holds dashboards, publications and reports; publishing writes the public fixture in place and revalidates, like indicator saves. Shared form pieces are in `components/forms` (`ErrorSummary`, `FieldMessage`, `IndicatorPicker`); `lib/picker-data.ts` loads published indicators, areas and peer groups for pickers.
- **Previews use the portal.** `/[locale]/embed/preview?d=` renders draft widgets with the portal's own `buildWidgets` and `WidgetView`; the widgets travel in the URL (`@onn/api-client/preview`, decoded as untrusted input, 24 widgets at most; past 7,000 characters the builder previews one widget at a time). Report chart blocks use `/embed/chart`. Both embeds post their height (`EmbedHeight`, message `onn-embed-height`) and `PreviewFrame` sizes the iframe from it. `portalUrl()` (`lib/content.ts`) uses `NEXT_PUBLIC_SITE_URL`, else the same origin in production and `localhost:3000` in development.
- **Dashboard builder** (`/dashboards/[slug]`): palette, a dnd-kit grid (`rectSortingStrategy`, keyboard sensor with translated announcements; give `DndContext` an `id` or its ids mismatch on hydration) and a resize handle that follows the pointer in whole columns or takes arrow keys. Server errors at `widgets.N.field` are mapped to widget ids; summary links select the widget and focus the field. After unpublishing, focus moves to Publish because the dialog's trigger is gone.
- **Publications**: the PDF is signed by the backend, so the detail page polls while `pending`; Publish stays visible with `aria-disabled` and the reason until `signed`. A live file can't be replaced (409). In the mock, signing takes 4 s and a file that doesn't start with `%PDF-` fails.
- **Reports** (`/reports/[id]`): blocks reorder by drag or with move buttons (focus stays on the moved block's button); text blocks use `RichTextEditor` (`packages/ui`, Tiptap, loaded with `next/dynamic`) with an assignee and a comment thread saved through its own endpoints, so comments don't make the report dirty. Generating PDF/DOCX needs saved changes; the job polls every 1.5 s, warns after 60 s and gives up at 5 minutes. The mock returns an empty PDF, and a text file in place of DOCX.
- **Shared admin form and list pieces.** `apps/admin/components/forms` has `useFormErrors` (field ids, `describedBy`, the focused summary), `ErrorSummary`, `FieldMessage`, `LanguageSwitch`, `ImageField`, `ConfirmDialog`, `DraftBar` (`useDraftPublish`), `RichText` and `IndicatorPicker`; `components/list.tsx` has `PrimaryLink`, `TabLinks`, `TableFrame`, `ListPager`, `listHref` and `FILTER_FIELD`. Server error codes map to sentences in `Admin.forms.error.*` through `errorCode()`; add a new code to `ERROR_CODES` and to the three catalogues. The BFF forwards DELETE as well as the other methods.
- **News and watch** (`/news`, `/news/new`, `/news/[slug]`; mock `packages/mocks/admin-editorial.ts`): bodies are HTML from Tiptap (the seed's Markdown is converted), one text per language. Statuses are draft, scheduled and published; saving a published item updates the portal at once. The watch queue (`?tab=watch`) approves, rejects, restores or turns a collected story into a draft, and holds the keyword and source settings. Scheduled news and newsletters settle on the next request in the mock (`editorial.tick()`, also called from the public `/news` routes).
- **Pages and home modules** (`/pages`, `/pages/[slug]`, `/pages/home`): CMS blocks stay Markdown and use `ContentStatus` (draft → publish), unlike news. Publishing writes the public fixture and revalidates `page:<slug>` or `home`.
- **Alerts and newsletter** (mock `packages/mocks/admin-outreach.ts`): alert rules are not evaluated when values publish, so the event log is seeded. The newsletter preview is the mock's stand-in email template in an iframe; sending records the audience size, and a sent campaign can't be edited (409 `state`). Public sign-ups from `/subscribers` land in the subscriber list.
- **Users** (`/users`, `/users/invite`, `/users/[id]`; mock `packages/mocks/admin-governance.ts`): status is `invited` until the first sign-in (`lastLogin` empty), and invited users aren't offered in the demo user list. Only a super admin sees the super admin role or may change someone who has it; nobody changes their own role or deactivates themselves. Those are data-dependent rules, so the form shows them (read-only fieldset, `aria-disabled` with the reason) instead of hiding. "Access review" is a plain download link to `/admin/bff/users/access-review` (CSV with a BOM).
- **Organisations** (`/organisations`, `/organisations/[code]`): they are the catalogue's data sources, so there is no "create". The form saves the profile and contacts (`Localised` name and description); assigned indicators, connectors and users are read-only links, because an indicator's organisation is its source.
- **Feedback inbox** (`/feedback`): status tabs and filters are links and a GET form; `FeedbackInbox` is the `DataTable` with selection, a `BulkActionBar` that sets a status, and a dialog per message with the status and an internal note. Public feedback keeps the sender's email for the inbox only.
- **Audit log** (`/audit`): every successful admin write is recorded. Handlers that know the before and after call `recordAudit()`; the `authed` wrapper in `admin.ts` adds a line for any other write (`auditRequest()`, entity from the path), skipping previews, tests, autosaves and read markers (`QUIET`). Each entry's diff is a `<details>` under its row, rendered on the server by `diffJson()` (`lib/governance.ts`). "Verify chain" recomputes the hashes on the server; the mock's hash is a stand-in (`digest()`), the backend picks the real one.
- **Settings** (`/settings`, super admin only): runtime overrides (empty means the deployment default, shown beside the field), feature toggles and API quotas save together; the SMTP and SMS tests keep their result on screen and on the server as "last test". In the mock an address at `fail.example` or a number ending `0000` fails. The portal doesn't read these settings yet: `country.features` is still fixed at build time.
- **Admin roles.** Hide what a role cannot do rather than disabling it. Disable with a tooltip only when the rule depends on data (e.g. approving your own submission). What each role may do is in `packages/api-client/permissions.ts` (`can(roles, action)`), shared by the admin UI and the mock so they can't drift; sidebar sections are in `apps/admin/lib/sections.ts`.

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
- Motion uses only the duration and easing tokens, and is removed or reduced to opacity under `prefers-reduced-motion` and in Lite mode. `base.css` does this globally (durations near zero so Radix still gets its animationend), so components don't each need `motion-reduce:`. Dropdowns fade with a 4px slide, dialogs fade, sheets slide. `onn-fade-in` crossfades a keyed tab panel, but only after the first click (`data-navigated` on `<html>`, set by `RoutePending`) so it never delays the first paint.
- Admin never serves cached submission data; only entry-grid drafts work offline.
- Offline: `app/sw.ts` (Serwist, built to `public/sw.js`, off in dev). It precaches only the two Source Sans files, brand files and each locale's home and `/offline` pages; build files are cached as pages use them (CacheFirst), pages and RSC payloads NetworkFirst, browser `/api/v1` GETs stale-while-revalidate (200 entries, 7 days), TopoJSON cache-first, and `/admin` is never cached. The uncached-page fallback is served with its scripts stripped, because its JS chunk was never cached and a failed chunk load makes Next show an error. `OfflineStatus` shows the banner with `<html data-rendered-at>` and loads `offline-worker.ts` when idle to register the worker and send the first page's files to it (`CACHE_URLS`). `next.config.ts` removes the window client `@serwist/next` always injects (about 2 KB per page).
- Forms sent offline (feedback, newsletter) go to a localStorage outbox (`lib/outbox.ts`) and are sent when the connection returns or the site is next opened, with a toast. Add new forms to `outbox-sync.ts`.
- Nothing streams on public pages: no `loading.tsx` and no Suspense around async Server Components, because a streamed fallback stays on screen without JavaScript. Route skeletons appear only on client navigation: `RoutePending` (`components/shell/route-pending.tsx`, in the site layout) listens for link clicks in the capture phase, hides the current page after 200 ms and shows the target's skeleton from `route-skeletons.tsx` (loaded on first click). Same-path query changes keep the old content. Add a case there for each new route.
- `error.tsx` (site and embed) uses `ErrorView`: "Try again" refreshes the RSC data and resets; "Report a problem" opens feedback with `page` and `error` (the Next digest, or a `c-` id for client errors), sent as `FeedbackInput.errorId`.
- Indicator empty states: `nearestAreaWithData()` walks up the area's parents to the national level, and `unavailableBreakdowns()` disables breakdown tabs with no data in the selected years. Both run only from the page, not the embed.
- Exports: after 60 s a toast says it's slow and polling continues to 5 minutes; failures show an error toast with a retry action (`showToast(message, "error", action)`).

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
- Catalogue: the page sends every indicator once and filters on the client with `lib/catalogue.ts`, which the server also uses to read the URL, so links and the no-JS form (repeated keys, `pillar=A&pillar=B`) give the same rows. The client writes comma lists back with `history.replaceState`; facets aren't in §4.4, so they use their own names (`q pillar source periodicity status sub`). Indicators that aren't published open a read-only `MetadataDrawer` whose metadata ships with the page. Hidden columns are a per-viewer `localStorage` choice. "Export XLSX" is an export job (`resource: "catalogue"`).
- Publications: filters are a GET form (`FilterForm`) that works without JS; with JS any change navigates and empty fields stay out of the URL. A page past the end shows the last page. `Pagination` (`packages/ui`) is server-safe and takes the app's `Link` as `linkAs`. The PDF preview is a lazy `<iframe>` from `md` up; phones get "Open PDF". Citation URLs use `siteOrigin()` (`lib/origin.ts`).
- CMS pages (about, methodology, partners, privacy, terms, accessibility) go through `CmsPageView` and `CmsBlocks` (`components/cms`). Rich text from the CMS and news is rendered on the server by `lib/rich-text.ts` (marked + sanitize-html, server-only), so it reads without JavaScript; the client `Markdown` component stays for indicator metadata with KaTeX. The privacy page adds the data protection law and authority from config above the CMS text. The release calendar on /about uses `IndicatorSummary.nextRelease`.
- SEO: `app/robots.ts` disallows `/admin` and each locale's `/embed/` and `/offline`, and lists one sitemap per locale. `/[locale]/sitemap.xml` is a route handler: static pages from `lib/nav.ts`, published indicators, publications, news and dashboards, each with hreflang alternates; a failing endpoint drops only its group. Add new top-level pages to `lib/nav.ts` or to `STATIC` there. Indicator pages carry a schema.org `Dataset` and publications a `Report` through `JsonLd` (`lib/seo.ts`).
- News: kind tabs (`?kind=watch`) and tag chips are links; `/[locale]/news/rss.xml` is an RSS 2.0 route handler. Share links are plain URLs, with no SDKs. Open data: `/[locale]/open-data/catalog.jsonld` is a DCAT catalogue built from `/datasets`; the middleware matcher skips `.jsonld` and `.xml`.
- Forms (feedback, API key) are Server Actions with `useActionState`, so they submit without JavaScript. Validation runs on the server; `ErrorSummary` takes focus and links to each field, and field errors are wired through `aria-describedby`. `safePath()` keeps the feedback page context to site paths.
- Developers: the Scalar API reference is about 1.3 MB gzipped (it bundles Vue), so it loads only from a button that states the size, never on scroll. `scalar-view.tsx` imports Scalar's stylesheet (the package doesn't), hides its toolbar, developer tools and AI agent, turns telemetry off, and marks its h1 as level 2. Scalar's collapsible sections fail axe `nested-interactive`; that is its own markup. `vue-demi`'s install script is denied in `pnpm-workspace.yaml`.
- Presentation mode loads on demand and redraws charts with `buildOption(..., { dark: true })`. The slide is `?p=` (1-based). `PresentButton` calls `requestFullscreen` inside the click handler, because browsers refuse it later; a `?p=` link opens the overlay without fullscreen.
- `packages/ui/base.css` has `@source "../charts"`; without it, chart classes aren't generated in the apps.
- `packages/ui` and `packages/charts` stay free of next-intl: components take translated labels as props.
- Locales: `/` redirects by the `NEXT_LOCALE` cookie, then Accept-Language, then the default (next-intl middleware). The cookie lasts a year (`localeCookie` in `i18n/routing.ts`) and is set on every page load, so the switcher works without JavaScript.
- API text that fell back (`fallback: true`) gets `lang={fallbackLang(item)}` on the element holding it and `<FallbackMark item={item} />` beside its title; the badge keeps the page language. The mock flags each object whose own text fell back.
- Each catalogue has `Meta.status`; `placeholder` (Wolof until reviewed) shows `Meta.notice` as a banner under the ribbon. Set it to `reviewed` when real strings arrive.
- Always format through `tagFor()` (`@onn/config/locale`, re-exported by the portal's `lib/format.ts`; the admin has its own `lib/format.ts`): it checks `Intl` support and falls back from the configured tag to the locale, the default locale's tag, then `en`. Never hard-code a locale such as `fr`; use `country.locales.default`.

## Accessibility lessons from the story tests

- Use `useRestoreFocus(open)` from `@onn/ui/lib/use-restore-focus` as `onCloseAutoFocus` on any controlled Radix dialog. Radix alone returned focus to `<body>`.
- Scrollable regions (drawer bodies, tables) need `tabIndex={0}`.
- Never hide a label with `invisible`: it leaves the accessible name. Use `opacity-0`.
- Anything with `position: absolute` (including `sr-only` text) inside a horizontal scroller needs a positioned ancestor inside the scroller, or it escapes the clip and widens the page; phones then zoom out. KpiCard is `relative` for this.
- Never put `sr-only` on a `<table>`: tables size to their cells, so the clipped table still widens the page on mobile. Put `sr-only` on a wrapping `div` (as `ChartFrame` does).
- Grid children default to `min-width: auto`, so a wide table or chart stretches its column; dashboard widgets are `min-w-0`. A bare `grid` (implicit `auto` track) has the same problem: its widest child sets the page width. Use `grid-cols-1` (a `minmax(0, 1fr)` track) for one-column grids. The reflow test found this in the portal footer (+9px at 320px on every page) and the import wizard.
- `DataTable` calls each column's `cell` function directly. Through `flexRender` it was mounted as a component, so a new `columns` array remounted every cell and a drawer opened from a cell couldn't return focus. Its scroll region is `relative` for the `sr-only` reason above.
- An open `listbox` must contain options; put empty-state text outside it in a `role="status"`.
- In play functions, dispatch native `DragEvent` and `ClipboardEvent` with a real `DataTransfer`: Testing Library's `fireEvent` copies the object's own properties into a new one, and a real `DataTransfer` has none, so files and pasted text are lost.
- Error toasts stay until closed and sit over the bottom of the page; use them for failures only, not for counts already shown on screen.

## Keeping bundles small

Trust measured downloads over the build table: at Phase 3 `next build` reported 115 KB for a home page that really downloaded 159 KB.

Measured by `e2e/budgets.mjs` at Phase 8 (360px, Chromium, chunks with zrender/maplibre excluded): home 174 KB, indicator 247 KB, `/data` 198 KB, `/map` after interaction 216 KB, home transfer 300 KB, fonts 1 file and 29 KB, SEN adm1 TopoJSON 35 KB raw. Leads for the home growth since 6d: the generated country config is copied into four chunks, and the indicator page's client manifest also loads the home page chunk (`HeroSelector`). The dashboard figure (373 KB) still counts some ECharts chunks that don't contain the word zrender. Measured gzipped JS at Phase 4: home 146 KB, data routes 161 KB. At Phase 5c: home 154 KB, `/data` profile 172 KB, indicator page 221 KB before ECharts (421 KB once the chart hydrates), `/map` 192 KB on first load and 217 KB after opening a panel and the list view (map budget 320 KB). At Phase 5d: dashboard pages 209 KB first load; home 156 KB. At Phase 5e: benchmark 181 KB, query 200 KB. At Phase 5f: catalogue 190 KB, publications list and detail 152 KB. At Phase 5g: about and other CMS pages 152 KB, news 161 KB, open data 161 KB, developers 166 KB (1.3 MB once the API reference is loaded), feedback 166 KB. Admin at Phase 7b (polyfills included): dashboard 176 KB, submissions list 206 KB, detail 207 KB, calendar 177 KB. At 7c: imports 178 KB, upload 182 KB, entry list 178 KB, entry grid 185 KB. At 7e: dashboards and other lists 180 KB, dashboard builder 210 KB, publication detail 189 KB, new publication 186 KB, report builder 211 KB before Tiptap (304 KB once the editor loads). At 7f: lists 190–199 KB, page and home editors 204 KB, alert form 202 KB, newsletter composer 207 KB, news editor 303 KB with Tiptap. At 7g: users, organisations and audit 191–193 KB, their forms and settings 197–198 KB, feedback inbox 224 KB (`DataTable` and the dialog). At 7d: connectors 180 KB, connector detail 188 KB, indicators 180 KB, indicator editor 189 KB, quality 218 KB before ECharts (394 KB once both chart runtimes hydrate). At Phase 6d: home 162 KB, indicator 229 KB, `/map` 200 KB, feedback 171 KB, about 154 KB. At Phase 6b, each page is about 1 KB more than at 6a (home 161 KB, indicator 228 KB). At Phase 6a (polyfills excluded): home 160 KB, `/data` 182 KB, indicator 227 KB, `/map` 198 KB, catalogue 194 KB, about 152 KB, feedback 169 KB. Third-party code measured with esbuild:

| Code                                                            | Gzipped |
| --------------------------------------------------------------- | ------- |
| ECharts core + SVG renderer                                     | 101 KB  |
| + line + grid (smallest usable line chart)                      | 150 KB  |
| Current line runtime (+ tooltip, legend, markLine, labelLayout) | 173 KB  |
| MapLibre client chunk (plus its worker)                         | 293 KB  |

So the indicator budget (230 KB with ECharts) and map budget (320 KB with MapLibre) can't be met as specified. The user decided how to handle both; see Spec decisions.

- Stop any local `next start` before building: rebuilding `.next` under a running server crashed the Togo admin build.
- If `next build` fails with a missing `vendor-chunks/*` module after dependency changes, or the admin build stops with `uncaughtException [TypeError: Cannot read properties of undefined (reading 'length')]`, delete that app's `.next` (stale cache).

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
- Check new header or top-bar controls against the corner `DemoRibbon`, which reserves inline-end padding there. At 360px the admin top bar hides the breadcrumb and the organisation name (the switcher keeps its accessible name).

## Testing and done (§10)

Layers: Vitest unit, Testing Library + Storybook interaction, Playwright e2e (Chromium, WebKit, Pixel 5) with axe, visual regression at 360/768/1280px, Lighthouse CI. The project is done only when all 10 journeys and every "Done when" item in §10 pass.

- **Layout of `e2e/`.** `tests/` holds the journeys (`indicator`: 1, 2, 6; `explore`: 3, 4, 5; `resilience`: 7, 8; `admin`: 9, 10) and `reflow.spec.ts` (no horizontal scroll at 320px on the main portal and admin pages). `helpers.ts` has `expectAccessible()` (axe, fails on serious or critical), `adminContext(browser, user)` (sets `onn-session` to the demo user id) and `pickOption()` for the APG comboboxes. `visual/` holds the story screenshots; `budgets.mjs` and `lighthouserc.cjs` the §9 checks. CI is `.github/workflows/ci.yml`.
- **The mock is shared and stateful.** Tests never assume counts it holds; admin journeys create their own data (a dashboard slug per project and run). The mock resets only when restarted, so rerunning against a reused server is fine.
- **Revalidation is asynchronous.** After a publish, poll the portal page rather than expecting the first load to show the value.
- **Visual baselines are per platform** (`visual/__screenshots__/{platform}`); only `linux/` is committed, made in the Playwright Docker image (README, "Visual baselines").
- **WebKit on Windows has no service workers**, so the offline journey skips there; CI runs it on Linux.
- **Budgets.** `budgets.mjs` counts chunks containing zrender or maplibre separately (spec decisions: ECharts loads near the viewport, MapLibre only behind the basemap toggle), and enforces home 170 KB, indicator 230 KB, map after interaction 320 KB, home transfer 900 KB, fonts 2 files and 90 KB, and adm1 TopoJSON 150 KB (raw).

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
- **Admin routing:** serve admin under `/admin` with Next.js multi-zones, with its locale in a cookie rather than the path. On localhost the portal and admin share the `NEXT_LOCALE` cookie, so browser tests that visit both should use separate contexts.
- **Admin role access:** the brief doesn't say which role sees which section or may do what, so `apps/admin/lib/sections.ts` (sections) and `packages/api-client/permissions.ts` (actions: contributors submit, editors verify and return, admins approve and publish, readers view; editors also edit content, alerts, the newsletter and feedback; admins manage users and organisations and read the audit log; only super admins change settings) hold an assumed mapping that the user should confirm.
- **Lite mode:** on first visit use the `Save-Data` request header, then the cookie. `navigator.connection` and Background Sync aren't available in WebKit, so queued forms also retry on page load.
- **Offline forms:** queued in a localStorage outbox and sent from the page (on reconnect or the next visit) instead of Background Sync: WebKit has none, and a queued Server Action request can't be replayed after a deploy changes its id. Forms aren't sent while the site is closed.
- **Loading states:** the user chose complete HTML on first load over streamed skeletons, because §8's `loading.tsx` left pages as grey blocks without JavaScript (§9). Skeletons show only on client navigation, so first byte waits on the slowest cached API call.
- **Wolof formatting:** set a tested fallback locale for numbers and dates in case `Intl` data for `wo` is missing.
- **Unspecified routes:** `catalog.jsonld` and the RSS feed get minimal definitions when their pages are built. `/embed/chart` takes the indicator page URL state (`i` plus `a c y d u`) and renders one chart with a link back.
- **Indicator page state:** toolbar changes (`u`, `d`, `y`) and the selector go through nuqs with `shallow: false`, so the server re-renders the page; `startTransition` keeps the old content under a progress line. View tabs are plain links so they work without JS. The disaggregated view drops the comparison series. The table puts the latest period first at every width (the brief asks for it on mobile only). The map view reuses the map page explorer.
- **Boundaries:** the user chose geoBoundaries as a stand-in until ANSD and INSEED supply official files. Every map shows the config `geography.boundaries` credit with a "not official boundaries" note. Togo's files are share-alike (ODbL, CC BY-SA). The mock area lists follow the files (no Keur Massar; Togo has 37 prefectures).
- **Missing assets:** official boundaries, logos, brand colours, reviewed Wolof strings and TGO config use visibly marked placeholders until supplied.
