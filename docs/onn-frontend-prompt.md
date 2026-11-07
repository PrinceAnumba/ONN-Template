# National Digital Observatory Template — Frontend Build Prompt

Nov 7, 2026 · @Prince

## 0. Scope

Build only the frontend of a reusable National Digital Observatory (ONN): the public data portal and the back-office user interface, as two Next.js apps sharing one design system. The backend (database, ETL, auth server, real API) is someone else's job. The frontend must run fully on its own against a mocked API that matches the contract in section 3, and switch to the real API by changing one environment variable.

- **Reference product (structure and UX):** [ITU DataHub](https://datahub.itu.int/) — the three-field selector (*Indicator or dashboard*, *Focus economy*, *Comparison economy*), Data explorer, Indicator catalogue, Data query, dashboards. Copy the patterns, not the ITU brand.
- **Reference requirements:** [PAENS ToR — ONN Senegal](https://paens.sn/termes-de-reference-refonte-site-web-observatoire-national-du-numerique/) — per-profile dashboards; line, bar, pie, radar and treemap charts; maps down to municipality level; gender/age breakdowns; presentation mode; French/Wolof/English; under 3 s on 3G; entry-level Android.
- **Country-agnostic:** every name, colour, language, map, institution and peer group comes from `country.config.ts` (section 2). No country string appears in a component.
- **No data in markup.** Every number on screen comes from the API client, with its source, reference year and a link to its metadata.

**In scope:** routing, layouts, all public pages, all back-office screens, design system, charts and maps, URL state, i18n, accessibility, offline shell, mock API + fixtures, unit/component/e2e tests, Storybook.

**Out of scope:** real authentication (mock a session; integrate an OIDC provider through NextAuth/Auth.js config only), server-side data processing, PDF/PPTX generation (call the export endpoints and handle the download), sending emails/SMS.

Numbers in this brief are requirements; use them as given.

## 1. Stack, repo layout, scripts

| Concern | Choice |
| --- | --- |
| Framework | Next.js 15 App Router, React 19, TypeScript strict |
| Styling | CSS Modules + CSS custom properties from tokens; no runtime CSS-in-JS |
| Data fetching | Server Components fetch on the server; client islands use TanStack Query v5 |
| URL state | `nuqs` (typed search params) |
| i18n | `next-intl`, locale prefix on every route |
| Charts | Apache ECharts 5 (SVG renderer, tree-shaken imports) via `packages/charts` wrappers; server-side static SVG via ECharts SSR |
| Maps | MapLibre GL JS (lazy) + `topojson-client`; static SVG fallback via `d3-geo` on the server |
| Forms (admin) | React Hook Form + Zod |
| Tables | TanStack Table v8 + TanStack Virtual |
| Rich text (admin) | Tiptap (Yjs collaboration plug-in left behind a feature flag) |
| Auth (admin) | Auth.js with an OIDC provider config; mock provider in dev |
| Mock API | MSW 2 (browser + Node) serving JSON fixtures |
| Tests | Vitest + Testing Library, Playwright (+ axe), Storybook 8 with interaction and a11y addons, Lighthouse CI |
| Tooling | pnpm workspaces + Turborepo, ESLint (incl. `jsx-a11y`, no-literal-strings rule), Prettier |

```text
apps/portal          public portal
apps/admin           back-office UI
packages/ui          design-system components + tokens.css
packages/charts      chart and map wrappers
packages/config      country.config.ts, Zod schema, token generator
packages/api-client  typed client + types (section 3), TanStack Query hooks
packages/mocks       MSW handlers + fixtures per country (fixtures/SEN, fixtures/TGO)
packages/i18n        shared message catalogues
```

**Scripts:** `pnpm dev` (both apps, mocks on), `pnpm dev:portal`, `pnpm build`, `pnpm test`, `pnpm e2e`, `pnpm storybook`, `pnpm lhci`. Environment: `NEXT_PUBLIC_API_BASE` (empty = mocks), `NEXT_PUBLIC_COUNTRY` (picks config + fixtures), `NEXT_PUBLIC_SITE_URL`.

## 2. Country config and design tokens

`packages/config/country.config.ts` exports a `CountryConfig` validated by Zod at build time (the build fails on a missing key). The frontend reads these keys only:

| Key | Used for |
| --- | --- |
| `iso3`, `name{locale}` | Page titles, focus default, meta tags |
| `observatory.shortName`, `longName{locale}`, `supportEmail` | Header, footer, `<title>` suffix, contact links |
| `owner.ministry`, `owner.unit`, `owner.funders[]` | Footer logos and About page |
| `locales.default`, `locales.enabled`, `locales.rtl` | Routing, switcher, `dir` |
| `currency`, `numberFormat`, `timezone` | `Intl` formatters |
| `geography.levels[]` (key, label, topojson url, lazy), `codeProperty`, `bbox` | Map levels, area pickers |
| `peers.default`, `peers.groups` | Comparison picker, benchmark page |
| `brand.primary`, `secondary`, `accent`, `neutralDark`, `logo`, `favicon` | Tokens, header, PWA manifest |
| `features.*` | Hide pages/controls (news watch, SMS sign-up, chatbot) |

A build script `packages/config/tokens.ts` writes `packages/ui/tokens.css` from `brand`. It computes `--onn-primary-ink` by darkening `brand.primary` in OKLCH until contrast on white is ≥ 4.5:1, and prints a warning when it had to.

**Tokens (`:root`):**

| Token | Value |
| --- | --- |
| `--onn-primary` / `--onn-primary-ink` | `{{brand.primary}}` / derived |
| `--onn-secondary` / `--onn-accent` | `{{brand.secondary}}` / `{{brand.accent}}` |
| `--onn-ink` | `{{brand.neutralDark}}` |
| `--onn-muted` | `#5B6472` |
| `--onn-line` | `#DDE2E8` |
| `--onn-surface` / `--onn-surface-2` | `#FFFFFF` / `#F5F7FA` |
| `--onn-positive` / `--onn-negative` | `#1A7F37` / `#C62828` |
| `--onn-compare` | `#8A94A6` |
| `--onn-focus` | `0 0 0 2px #fff, 0 0 0 4px var(--onn-primary-ink)` |
| `--onn-radius-card` / `-input` / `-pill` | `8px` / `6px` / `999px` |
| `--onn-shadow-1` | `0 1px 2px rgb(15 28 46 / .06), 0 2px 8px rgb(15 28 46 / .06)` |
| `--onn-shadow-2` | `0 8px 28px -8px rgb(15 28 46 / .22)` (sheets, popovers) |
| `--onn-ease` | `cubic-bezier(.2, .8, .2, 1)` |
| `--onn-dur-1` / `-2` / `-3` | `120ms` / `220ms` / `360ms` |
| Spacing | `--s-1`…`--s-8` = 4, 8, 12, 16, 24, 32, 48, 64 px |

`color-scheme: light`; no dark mode in v1.

**Type:** "Source Sans 3" variable, self-hosted WOFF2, Latin + Latin Extended subset, `font-display: swap`, preload regular (≤ 45 KB); fallback `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`.

| Style | Desktop | Mobile (< 768px) | Weight / line-height |
| --- | --- | --- | --- |
| display | 44px | 30px | 700 / 1.1 |
| h1 | 34px | 26px | 700 / 1.15 |
| h2 | 26px | 21px | 600 / 1.2 |
| h3 | 20px | 18px | 600 / 1.25 |
| body | 16px | 16px | 400 / 1.5 |
| small | 14px | 14px | 400 / 1.45 |
| caption / axis | 12px | 12px | 400 / 1.4, `--onn-muted` |
| KPI value | 36px | 28px | 600 / 1, tabular-nums |

**Grid:** container max 1280px, gutters 24px (16px under 640px); breakpoints 640, 768, 1024, 1280; 12-column grid with 24px gap.

**Chart palette:** focus = `--onn-primary`; comparison = `--onn-compare` dashed 2px; peer band = primary at 12% opacity; categorical series Okabe-Ito `#0072B2 #E69F00 #009E73 #CC79A7 #56B4E9 #D55E00 #F0E442 #000000`; sequential map 5 steps from `--onn-surface-2` to `--onn-primary-ink`; no-data = 45° grey hatch pattern.

## 3. API contract and mock layer

The frontend owns this contract as TypeScript in `packages/api-client/types.ts`. The backend team implements it; until then MSW serves it. Base path `${NEXT_PUBLIC_API_BASE}/api/v1`. Labels come back in the language from `Accept-Language`.

```ts
type Locale = string;                       // from config.locales.enabled
type ObsStatus = "A" | "E" | "P" | "B" | "F" | "M"; // normal, estimate, provisional, break, forecast, missing

interface Pillar { code: string; name: string; icon: string; order: number; themes: Theme[]; indicatorCount: number }
interface Theme { code: string; name: string; indicatorCount: number }

interface IndicatorSummary {
  code: string; name: string; shortDefinition: string; pillar: string; theme: string;
  unit: string; unitVariants: { code: string; label: string }[];
  periodicity: "monthly" | "quarterly" | "annual" | "biennial";
  geoLevels: string[];                      // ["national","adm1","adm2"]
  disaggregations: string[];                // ["sex","age_group","area","operator"]
  higherIsBetter: boolean; isHeadline: boolean;
  latest?: { value: number; year: string; changePct?: number };
  status: "published" | "in_collection" | "planned";
  lastUpdated: string;                      // ISO date
}
interface Indicator extends IndicatorSummary {
  definition: string; computation?: string; // markdown, may contain $$LaTeX$$
  source: { org: string; method: "survey" | "administrative" | "computed" | "international" };
  intlRefs: { org: "ITU" | "WB" | "UN" | "AU"; code: string; name: string; url: string }[];
  coverage: { from: string; to: string; areas: number };
  qualityNotes?: string; nextRelease?: string; versions: { version: number; date: string; note: string }[];
  licence: string; related: string[]; dashboards: { slug: string; title: string }[];
}
interface Area { code: string; level: "country" | "adm1" | "adm2" | "adm3" | "group"; name: string; parent?: string; iso3?: string }
interface Observation {
  indicator: string; area: string; period: string; dims: Record<string, string>;
  value: number | null; unit: string; status: ObsStatus; source: string; version: number;
}
interface Series { indicator: string; area: string; dims: Record<string, string>; unit: string; points: { period: string; value: number | null; status: ObsStatus }[] }
interface PeerRow { area: string; name: string; value: number | null; year: string; rank: number }
interface PeerStats { year: string; median: number; min: number; max: number }
interface Dashboard { slug: string; title: string; description: string; audience: "decision" | "analyst" | "public"; widgets: Widget[] }
interface Widget {
  id: string; type: "kpi" | "line" | "bar" | "stacked" | "donut" | "radar" | "treemap" | "map" | "table" | "target" | "text";
  title: string; indicators: string[]; area?: string; compare?: string; years?: string; dims?: Record<string, string>;
  span: 1 | 2 | 3; body?: string;
}
interface Publication { slug: string; type: "quarterly" | "annual" | "study" | "method"; title: string; summary: string; date: string; pillar?: string; coverUrl: string; fileUrl: string; fileBytes: number; verified: boolean }
interface NewsItem { slug: string; title: string; excerpt: string; date: string; tags: string[]; kind: "news" | "watch"; sourceUrl?: string; imageUrl?: string }
interface Page<T> { items: T[]; meta: { total: number; page: number; pageSize: number } }
interface Problem { type: string; title: string; status: number; detail?: string; errors?: { path: string; message: string }[] }
```

**Endpoints the portal calls:**

| Call | Used on |
| --- | --- |
| `GET /pillars` | Explorer tree, catalogue filters, home |
| `GET /indicators?q&pillar&theme&geo_level&headline&page` | Selector search, catalogue, home KPIs |
| `GET /indicators/{code}` | Indicator page, metadata drawer |
| `GET /areas?level&parent` | Area pickers, map side panel |
| `GET /areas/{code}/geometry?level` | Map (TopoJSON); also static under `/geo/*.topo.json` |
| `GET /series?indicator&area&years&dims&unit` | Line charts, sparklines |
| `GET /data?indicator&area&year&dims&unit&format` | Tables, query tool, map values, downloads |
| `GET /data/latest?indicator&area` | KPI cards, map |
| `GET /benchmark?indicator&group&year` | Benchmark page → `{rows: PeerRow[], stats: PeerStats[]}` |
| `GET /index?year` | Index dashboard |
| `GET /targets` | Strategy tracker |
| `GET /dashboards`, `/dashboards/{slug}` | Dashboards |
| `GET /publications?type&year&pillar&page`, `/publications/{slug}` | Publications |
| `GET /news?kind&tag&page`, `/news/{slug}` | News |
| `GET /home` | Home modules configured in the CMS (example chips, featured indicators) |
| `POST /feedback` | Feedback form and "Was this useful?" |
| `POST /subscribers` | Newsletter sign-up |
| `POST /exports` → `{jobId}`; `GET /exports/{jobId}` → `{status, url}` | PDF/PPTX/XLSX exports (poll every 1.5 s, max 60 s) |

Admin endpoints are listed with their screens in section 7.

**Client rules:** one `apiFetch` wrapper that adds locale, timeout 15 s, one retry on network failure (not on 4xx), parses `Problem` errors into a typed `ApiError`. Server Components fetch with `next: { revalidate: 300, tags: ["indicator:<code>"] }` so the backend's publish webhook can call `revalidateTag`. Client components use TanStack Query (`staleTime` 5 min, `gcTime` 30 min).

**Mocks:** `packages/mocks/fixtures/{ISO3}/` holds `pillars.json`, `indicators.json` (≥ 40 indicators across 8 pillars: Connectivity and infrastructure, Access and use, Markets, Affordability, Skills, Trust and security, Governance and regulation, Digital economy and sustainability — e.g. 4G population coverage, Internet users %, mobile broadband per 100, fixed broadband per 100, households with Internet, 2 GB data basket % GNI p.c., ICT skills, Global Cybersecurity Index, e-services online, ICT share of GDP, national index score), `areas.json`, `observations.ndjson` (2015–2025, national + adm1 + adm2, sex/age/area dims where relevant, a few `E`/`P`/`B` flags, some gaps), `peers.json`, `dashboards.json`, `publications.json`, `news.json`. Values are synthetic but plausible (monotonic trends, realistic ranges) and every page shows a "Demo data" ribbon when mocks are on. A fixture generator `pnpm mocks:gen --country=SEN --seed=42` produces them deterministically. Handlers add 150–600 ms random latency and a `?_fail=1` switch to force errors for testing.

## 4. App shell

### 4.1 Header (portal)

- Height 72px desktop / 60px under 1024px; white; `border-bottom: 1px solid var(--onn-line)`; sticky at top with `backdrop-filter: saturate(1.4) blur(8px)` over `rgb(255 255 255 / .92)` once the page scrolls past 8px (add a `--onn-shadow-1` at that point).
- Left: logo (height 36px, from `brand.logo`) + observatory short name (h3 weight) linking to `/`.
- Centre (≥ 1024px): primary nav *Data*, *Map*, *Dashboards*, *Publications*, *News*, *Open data*, *About*; 15px, weight 500; active item gets a 2px `--onn-primary` underline 6px below the text; hover underline grows from centre over `--onn-dur-2`.
- Right: search button (opens command palette, shortcut `/` or `Ctrl+K`), locale switcher (shows codes `FR · EN · WO`, current one bold; changes locale and keeps path and query), and "Developers" text link.
- Under 1024px: logo + search + menu button. Menu opens a full-height right drawer (width `min(360px, 88vw)`, slides in from the right over `--onn-dur-3`, scrim `rgb(15 28 46 / .4)`), containing nav, locale switcher and links. Focus is trapped; Esc and scrim close it; focus returns to the menu button.
- **Command palette search:** modal 640px wide, input at top, results grouped *Indicators* (code, name, pillar), *Areas*, *Publications*, *News*, *Pages*; arrow keys + Enter; debounced 200ms; empty state shows 6 popular indicators.

### 4.2 Selector bar (data pages)

The DataHub pattern. A bar under the header on `/data`, `/map`, `/benchmark`, `/dashboards/*`: background `--onn-surface-2`, padding 12px 0, three comboboxes side by side (equal width, 12px gap) + a "Reset" text button.

1. **Indicator or dashboard** — grouped by pillar then theme; dashboards in their own group at the top; type-ahead over name, code and synonyms; each option shows name + unit + small badge "sub-national" when maps are possible.
2. **Focus area** — the country (default), then territories grouped by level, indented by hierarchy.
3. **Comparison** — none (default), another territory, a peer country, or a peer group (`Peer group: ECOWAS`, etc.).

Changing any field updates the URL (section 4.4) with `history.replaceState` for typing and `pushState` on selection, and the page re-renders without a full reload. Under 768px the bar collapses into one pill button "Choose data · {indicator short name}" that opens a bottom sheet with the three fields stacked and an "Apply" button.

### 4.3 Footer

Background `--onn-ink`, white text, padding 48px 0 32px. Four columns (≥ 1024px; stacked below): (1) logo in white + mission line + "Data last updated {date}" from `GET /home`; (2) Explore links; (3) About, methodology, partners, legal, accessibility; (4) newsletter form (email + submit, inline success and error) and social links. Bottom row: ministry and funder logos (monochrome white, 32px high), licence line "Data: CC BY 4.0", copyright.

### 4.4 URL state

Typed with `nuqs`. Parameters: `i` indicator code(s) comma-separated, `a` focus area, `c` comparison (`area code`, `ISO3`, or `peer:GROUP`), `y` year or `YYYY-YYYY`, `d` dims as `key:value` comma list, `u` unit variant, `v` view (`chart`/`table`/`map`), `l` map level. Defaults are omitted from the URL. Every combination must survive reload and sharing. Invalid values fall back to defaults with a toast "Some filters in this link are no longer available."

### 4.5 Back-office shell

Left sidebar 248px (collapses to 64px icons; off-canvas under 1024px) with sections Dashboard, Submissions, Data entry, Imports, Connectors, Quality, Indicators, Dashboards, Publications, Reports, News, Pages, Alerts, Newsletter, Users, Organisations, Feedback, Audit log, Settings — each shown only if the session's role allows it. Top bar: breadcrumb, org switcher (users with several orgs), notifications bell with unread count, profile menu (language, MFA settings, sign out). Content max-width 1440px.

## 5. Public pages

All routes sit under `/[locale]`. Every page is a Server Component that streams; interactive parts are client islands. Each page sets `<title>` as "{page} — {observatory.shortName} {country.name}", a meta description, Open Graph image (rendered with `next/og`: indicator name, latest value, sparkline, logo), canonical and `hreflang` alternates.

### 5.1 Home `/`

1. **Hero** — `--onn-surface-2` background, padding 64px 0 48px (40px 0 32px mobile). Display heading = `longName`; one-line mission from `GET /home`; the selector bar inline (three fields + primary button "Explore", 48px high); below it 3–5 example chips (pill, 1px `--onn-line` border, 14px) linking to pre-filled `/data?…` URLs.
2. **Headline KPIs** — h2 "Key figures" + "As of {latest year}". Grid of 8 `KpiCard`s: 4 columns ≥ 1024px, 2 columns 640–1023px, horizontal scroll-snap row under 640px (cards 82% width, 12px gap, snap start, visible dots).
3. **Strategy tracker** — h2 = strategy name; one row per target: indicator name, horizontal progress bar (track `--onn-line`, fill `--onn-primary`, target tick mark), "{current} of {target} by {year}", status pill (On track green / At risk amber `#B26A00` / Off track red) computed client-side from the series' linear trend.
4. **Map teaser** — two columns: left text (indicator, latest year, top and bottom region), right static SVG choropleth of adm1 (server-rendered, no JS); whole card links to `/map?i=…`.
5. **Benchmark strip** — horizontal ranked bars for the default peer group on one featured indicator; focus country bar in `--onn-primary`, others `--onn-compare`; value labels at bar end; "Compare more" link.
6. **Dashboards** — 3-column cards (thumbnail 16:9 server-rendered SVG, title, audience badge, description 2 lines).
7. **Latest publications** — 3 cards: cover (3:4, lazy), type badge, title (2-line clamp), date, file size, "Download PDF".
8. **News and watch** — 3 items in a list (date, tag, title, excerpt); "See all".
9. **Data partners** — logo wall (grayscale, colour on hover), each with "last submission {date}" tooltip.

### 5.2 Data explorer `/data`

Layout ≥ 1024px: left rail 288px, sticky under the selector bar, scrollable, with the pillar → theme → indicator tree (disclosure buttons, counts, search field filtering the tree, current indicator highlighted with a 3px left border in `--onn-primary`). Main column fluid. Under 1024px the tree opens from a "Browse indicators" button as a left drawer.

**No indicator selected → country (or area) profile:** title "{area} digital profile", year badge, "Download profile (PDF)" button (export job). One section per pillar: pillar icon + name + one-sentence description, grid of 4–6 `KpiCard`s (headline indicators of that pillar), "See all {n} indicators" link expanding a compact table (name, latest value, year, trend arrow).

### 5.3 Indicator page `/data/[code]`

- **Header:** breadcrumb (Data › Pillar › Theme), h1 indicator name, a line of chips (unit, periodicity, source org, "ITU equivalent" link when `intlRefs` has ITU), two-line short definition with "Full metadata" button opening `MetadataDrawer`. Right side: big latest value for the focus area, year, change vs previous period (arrow + %, coloured using `higherIsBetter`).
- **Toolbar:** view tabs *Chart / Table / Map* (Map only if `geoLevels` contains a sub-national level), unit variant select, disaggregation tabs (only those in `disaggregations`: e.g. Total | Sex | Age | Urban/rural | Operator), year range slider, and actions: Download (CSV, XLSX, JSON, PNG, SVG), Share (copy link, native share on mobile), Embed (iframe snippet of `/embed/chart?…`).
- **Chart view:** line chart 420px high (300px mobile). Focus series solid 2.5px `--onn-primary` with 4px dots on the last point and points with a status flag (hollow dot for E/P, vertical dashed rule labelled "Break in series" for B). Comparison series dashed `--onn-compare`. Peer group: median line + shaded min–max band. Disaggregated view: one line per category (palette), legend toggles series. Tooltip: period, each series value with unit and status label. Under the chart: source line "Source: {org}, {method}. Last updated {date}." and an auto text summary.
- **Table view:** rows = areas (or categories), columns = periods (latest first on mobile), sticky first column and header, status flags as superscripts with a legend below, sort by any column, CSV/XLSX download.
- **Map view:** embedded version of the map page (5.4) locked to this indicator.
- **Side column (≥ 1280px, else below):** Related indicators (4 links with sparklines), Used in dashboards, Release calendar ("Next update expected {month}"), Feedback widget "Was this useful? Yes / No" with optional comment.
- **MetadataDrawer:** right drawer 560px (full-screen sheet on mobile): code, definition, computation (render markdown + KaTeX, lazy), unit and variants, periodicity, source, international references (links), disaggregations, coverage, quality notes, version history list, licence, "Report an issue".

### 5.4 Map `/map`

Full-bleed below the selector bar, height `calc(100dvh - header - selector bar)`, min 520px. MapLibre loads only when the map scrolls into view or on this page; until then a server-rendered SVG of the same choropleth shows (so the page is useful with no JS).

- Controls panel (top-left card, 320px): level segmented control from `geography.levels` (adm3 loads its TopoJSON on demand with a progress line), classification select (Quantiles default, Equal interval, Natural breaks), year slider with play/pause (advance every 1200ms, stops at the last year), "Show labels" toggle.
- Legend (bottom-left): 5 colour classes with ranges and counts, plus "No data" hatch.
- Hover (pointer devices): area outline 2px `--onn-ink`, tooltip with name and value.
- Click/tap: selects the area (outline 3px `--onn-primary-ink`) and opens the detail panel — right panel 380px on desktop, bottom sheet on mobile with snap points 96px (name + value), 50%, 92%. Panel: name, level, value + year, rank among siblings ("3rd of 14 regions"), sparkline, disaggregation bars (sex, area) if available, children list, buttons "Open in explorer" and "Set as focus".
- Keyboard: areas are reachable through a "List view" toggle that swaps the map for a sortable table of areas (same data).
- No basemap by default (boundaries on `--onn-surface`); optional OSM-based raster basemap toggle only if `features.basemap`.

### 5.5 Dashboards `/dashboards` and `/dashboards/[slug]`

Index: cards as on home, filter by audience. Detail: title, description, "Present" button and "Export" menu (PDF, PPTX via export jobs). Widgets render in a 3-column grid (`span` 1–3; everything single-column under 768px). Widget types map to components in section 6. Each widget header has title, a ⋮ menu (View data, Download CSV, Open in explorer, Copy link to widget `#w-{id}`).

**Presentation mode:** fullscreen (Fullscreen API with a fallback fixed overlay), `--onn-ink` background, one widget per slide scaled to fit 16:9, title 40px white, chart re-themed for dark background, footer with logo, source and "{n} / {total}". Navigation: ←/→, PageUp/PageDown, space, swipe, on-screen arrows; Esc exits; `?p=3` deep-links to a slide.

### 5.6 Benchmark `/benchmark`

Peer group tabs (from `peers.groups`), indicator from the selector. Three blocks: (1) ranked horizontal bars for the latest common year with group median as a vertical dashed line and the focus country highlighted; (2) slope chart of rank over the last 5 years for focus + 4 nearest peers; (3) table: economy, value, year, rank, gap to median (signed, coloured). Note under it: "Peer data: ITU DataHub / World Bank, retrieved {date}."

### 5.7 Data query `/query`

Three numbered steps in a left column (sticky on desktop, accordion on mobile): 1 Indicators (multi-select list with search, pillar filter chips, "{n} selected", "Clear all"), 2 Areas (tree with checkboxes: country, levels, peers, groups), 3 Years (range slider, default last 8). "Apply filters" button (disabled until each step has a selection). Right column: long-format preview table (first 100 rows, virtualised), row count, "Download" menu (CSV, XLSX, JSON, SDMX-CSV), and a code panel showing the equivalent API URL plus curl / Python / R / JS snippets with copy buttons. State in URL.

### 5.8 Catalogue `/catalogue`

Full-width data table of indicators: code, name, pillar, unit, periodicity, source, international equivalent, sub-national (✓/—), last update, status pill (Published / In collection / Planned). Facet filters on the left (pillar, source, periodicity, status, sub-national); search; column chooser; export XLSX. Rows link to the indicator page (status Published) or open a read-only metadata drawer (others).

### 5.9 Publications, news, open data, developers, about, feedback, legal

- `/publications`: filters (type, year, pillar), grid of cards, pagination 12/page. Detail: cover, title, date, summary, "Verified signature" badge when `verified`, PDF preview (lazy `<iframe>` with "Open PDF" fallback on mobile), download with size, citation block with copy button.
- `/news`: tabs *News* / *Technology watch*, tag filter, list with date and excerpt, pagination; detail page with hero image (optional), body (rich text), source link for watch items, share links, related items; RSS link.
- `/open-data`: dataset cards (pillar datasets + full dump) with formats, licence, update frequency, last update, download buttons; link to `catalog.jsonld`.
- `/developers`: embedded API reference (Scalar, lazy) from the OpenAPI URL, quick-start tabs (curl, Python, R, JS), "Get an API key" form (name, email, organisation, intended use, accept terms) → confirmation screen.
- `/about`, `/about/methodology`, `/about/partners`: CMS pages rendered from blocks (rich text, image, callout, table, partner grid), release calendar table (indicator, expected month), contact card.
- `/feedback`: rating (5 large tappable stars with labels), message (max 2,000 chars, counter), optional email, page context auto-filled; success state with "Back to where you were".
- `/legal/privacy`, `/legal/terms`, `/accessibility`: CMS text pages; the privacy page names the data protection law and authority from config.

## 6. Components and chart behaviour

Every component lives in `packages/ui` or `packages/charts`, has a Storybook story with all states (default, loading, empty, error, long text, RTL, mobile), and a Playwright/axe check.

| Component | Spec |
| --- | --- |
| `Button` | Variants primary (`--onn-primary` bg, white), secondary (white, 1px `--onn-line`, `--onn-ink` text), ghost, danger; sizes 36 / 44 / 48px high; radius 6px; hover darkens 8%; active `scale(.98)`; disabled 45% opacity; loading shows a 16px spinner and keeps width |
| `Combobox` | ARIA APG combobox with listbox; grouped options with sticky group headers; type-ahead; keyboard Up/Down/Home/End/Enter/Esc; clear button; max list height 360px; on mobile opens a full-screen sheet with the search field focused |
| `KpiCard` | 1px `--onn-line` border, radius 8px, padding 20px; label (14px, 2-line clamp); value (KPI style) + unit (16px muted); year caption; change chip (▲/▼ + %, green/red by `higherIsBetter`, grey when flat ±0.5%); 10-point sparkline 32px high, no axes; whole card is a link with hover lift `translateY(-2px)` + `--onn-shadow-1`; status flag superscript if latest point is E/P |
| `ChartFrame` | Wraps every chart: title (h3), optional subtitle, plot, source line, actions (Download PNG/SVG/CSV, Share, Embed, View as table); renders an SSR SVG first, then hydrates when 200px from the viewport (IntersectionObserver) |
| `LineChart` | Y axis starts at 0 for counts and percentages unless the range < 10% of max; gridlines horizontal only, `--onn-line`; x labels thin out to fit; last-point label shows value; series end labels instead of a legend when ≤ 4 series |
| `BarChart` / `RankedBars` | Horizontal when labels are long or > 8 items; value labels inside bar end (outside if bar < 40px); focus bar primary, others compare grey |
| `StackedBar` | Only for parts of a whole; toggle absolute / 100% |
| `Donut` | Max 6 slices, rest grouped "Other"; centre shows total; slice labels outside with leader lines |
| `Radar` | Pillar scores 0–100; focus filled at 20% opacity, comparison outline dashed |
| `Treemap` | Market or category breakdown; labels hidden when tile < 60×30px, shown in tooltip |
| `TargetProgress` | Track + fill + target tick + status pill (see 5.1) |
| `ChoroplethMap` | MapLibre on client, `d3-geo` SVG on server; same classification code both sides so the colours match |
| `DataTable` | TanStack Table; sticky header and first column; sort; resizable columns (desktop); virtualise over 200 rows; numeric columns right-aligned with tabular nums; empty cell shows "—" with status legend |
| `MetadataDrawer`, `Drawer`, `BottomSheet` | Focus trap, Esc to close, scrim click closes, return focus; sheet supports drag with snap points and respects `prefers-reduced-motion` |
| `YearSlider` | Dual-thumb range, keyboard arrows step 1 year, PageUp/Down 5; labels above thumbs |
| `DisaggregationTabs` | Segmented control; overflow scrolls horizontally on mobile |
| `Toast` | Bottom-centre, max 3 stacked, auto-dismiss 4s (errors stay until closed), `role="status"` or `role="alert"` |
| `DemoRibbon` | Fixed top-right corner ribbon "Demo data" when mocks are on |
| `LiteModeToggle` | In footer; see section 9 |

**Number formatting** (`packages/ui/format.ts`): percentages one decimal (`43.7 %` with the locale's spacing rules); per-100 rates one decimal; counts with grouping, compact on cards (`1.2 M`, `850 k`); currency via `Intl.NumberFormat` with config currency; null → "—". Periods: `2025`, `T3 2025`/`Q3 2025` by locale.

**Chart theming:** one ECharts theme generated from tokens; fonts inherit; animation 400ms `cubicOut` on first render only, none on updates under reduced motion. Every chart sets `aria-label` with a generated summary and has a visually hidden table. Exports: PNG at 2× with title, source and logo baked in; SVG; CSV of exactly what is plotted.

## 7. Back-office screens (`apps/admin`)

Roles drive what renders: `super_admin`, `admin`, `editor`, `contributor`, `reader`. The session (mocked in dev via a role switcher in the profile menu) carries `{user, roles[], orgs[], activeOrg, mfa}`. Hide what a role cannot do; never just disable it, except buttons whose rule depends on data (e.g. "Approve" disabled with a tooltip "You cannot approve your own submission"). All screens are desktop-first but usable at 768px; data entry grids must work on a tablet.

Shared list-page pattern: page title + primary action top-right; filter bar (search, facet dropdowns, date range, "Clear"); `DataTable` with selection checkboxes, bulk-action bar sliding up from the bottom when rows are selected; pagination 25/50/100; empty state with an illustration-free icon, one sentence and the primary action.

| Screen | Route | Contents | API |
| --- | --- | --- | --- |
| Sign-in | `/admin/login` | Logo, "Sign in with {SSO}" button, MFA step screen (6-digit code input, auto-advance, paste support), error states | Auth.js |
| Dashboard | `/admin` | Role-aware cards: my tasks (submissions to verify/approve), upcoming deadlines (next 30 days), quality pass rate, connector failures, latest feedback, site usage sparkline | `GET /admin/overview` |
| Collection calendar | `/admin/calendar` | Month grid + list toggle; each item: org, indicator set, period, deadline, status pill; overdue in red | `GET /admin/calendar` |
| Submissions list | `/admin/submissions` | Columns: ID, org, indicators, period, channel, status, submitted by, updated; status tabs Draft / Submitted / Verified / Approved / Published / Returned | `GET /admin/submissions` |
| Submission detail | `/admin/submissions/[id]` | Header with status stepper (Draft → Submitted → Verified → Approved → Published); tabs *Data* (grid of rows with error/warning icons per cell), *Quality* (rule results, justification inputs for warnings), *Diff* (vs currently published values, changed cells highlighted), *History* (timeline of transitions with comments); action bar with the transitions the role allows; "Return" requires a comment (modal) | `GET /admin/submissions/{id}`, `POST …/transition` |
| File import wizard | `/admin/imports/new` | 4 steps: Upload (drag-drop, CSV/XLSX/JSON/XML ≤ 50 MB, "Download template" per indicator set) → Map columns (auto-matched, dropdown per column, preview 20 rows) → Validate (counts of errors/warnings, row-level list, filter to errors, download error report CSV) → Submit (summary, comment) | `POST /admin/imports`, `GET /admin/imports/{id}` (poll) |
| Manual data entry | `/admin/entry/[indicator]` | Spreadsheet-like grid (areas × periods, dims as row groups); previous period shown greyed in each cell's corner; arrow-key navigation, paste from Excel, inline validation; autosave every 10 s with "Saved {time}" indicator; offline drafts in IndexedDB with a "You're offline — changes saved on this device" banner | `GET/PUT /admin/entry/{indicator}?period` |
| Connectors | `/admin/connectors`, `/[id]` | List with last run status; detail: settings form (type, endpoint, schedule with cron helper text "Every Monday at 06:00"), field-mapping table, "Test connection", "Dry run" (shows first 50 mapped rows), run history with logs | `/admin/connectors*` |
| Quality | `/admin/quality` | Pass-rate charts by org, indicator and period; table of open warnings with links to submissions | `GET /admin/quality` |
| Indicators (referential) | `/admin/indicators`, `/[code]` | List with status and prioritisation score; editor with tabs *General* (names per locale side by side), *Definition* (markdown + LaTeX preview), *Units*, *Dimensions*, *Geography*, *Thresholds and alerts*, *Goalposts*, *International references*, *Release calendar*, *Prioritisation* (4 sliders 1–5: availability, quality, strategic use, comparability), *Versions*; save creates a new version with a note | `/admin/indicators*` |
| Dashboards builder | `/admin/dashboards/[slug]` | Left: widget palette; centre: 3-column grid with drag-and-drop (dnd-kit) and resize to span 1–3; right: widget settings (type, indicators, area, comparison, years, dims, title per locale); live preview using portal components; publish / unpublish | `/admin/dashboards*` |
| Publications | `/admin/publications` | Upload PDF + cover, metadata per locale, type, period, pillar; shows signature status after backend signs | `/admin/publications*` |
| Report builder | `/admin/reports/[id]` | Template picker (Quarterly, Annual); ordered blocks (text, KPI grid, chart, map, table) with drag reorder; text blocks in Tiptap with comments and assignees; chart blocks pick indicator + period and preview live; "Generate PDF / DOCX" starts an export job and shows progress | `/admin/reports*`, `/exports` |
| News and watch | `/admin/news` | Article editor (Tiptap, image upload, tags, locales, schedule); *Watch queue* tab: auto-collected items with Approve / Reject / Edit, keyword and source settings | `/admin/news*` |
| Pages (CMS) | `/admin/pages` | Block editor for About/legal pages and home modules (example chips, featured indicators, map teaser indicator) | `/admin/pages*` |
| Alerts | `/admin/alerts` | Rules list; rule form (indicator, condition: threshold / change % / off-track / overdue / anomaly, recipients, channels); event log | `/admin/alerts*` |
| Newsletter | `/admin/newsletter` | Compose from published items, audience by topic and locale, preview desktop/mobile, send or schedule; past sends with open/click rates; subscriber list | `/admin/newsletter*` |
| Users | `/admin/users` | Invite (email, org, role), MFA status, last login, deactivate; "Access review" export | `/admin/users*` |
| Organisations | `/admin/organisations` | Profile, contacts, assigned indicators, connectors | `/admin/organisations*` |
| Feedback | `/admin/feedback` | Inbox with rating, page, message; status New / Planned / Done / Won't do | `/admin/feedback*` |
| Audit log | `/admin/audit` | Filter by actor, entity, action, date; expandable row shows before/after JSON diff; "Verify chain" button shows result | `/admin/audit*` |
| Settings | `/admin/settings` | Runtime config overrides, feature toggles, API quotas, SMTP/SMS test buttons | `/admin/settings` |

All admin types live next to the public ones in `packages/api-client`, and MSW mocks cover every admin endpoint with a stateful in-memory store so the workflow can be clicked through end to end (create → submit → verify → approve → publish shows up on the portal mock).

## 8. States and motion

**Loading:** route-level `loading.tsx` shows skeletons with the final layout's exact dimensions (no layout shift): KPI cards as grey blocks (value bar 60% width, sparkline bar), charts as a box with 3 faint gridlines, tables as 8 rows. Skeleton shimmer is a 1.4 s linear gradient sweep; static grey under reduced motion. Client refetches keep the old data visible with a 2px progress line at the top of the `ChartFrame` instead of swapping to a skeleton.

**Empty:**

- Indicator has no data for the chosen area: "No data for {area} yet" + the nearest level that has data as a link + release calendar date.
- Disaggregation not available for a year: that tab is disabled with a tooltip.
- Search with no results: "No matches for '{q}'" + 6 popular indicators.
- Map class with no data: hatched, legend entry "No data ({n})".

**Errors:** `error.tsx` per route group with a plain message, "Try again" (calls `reset`), and "Report a problem" (opens feedback with the error id). Widget-level errors stay inside the widget (`ChartFrame` shows "Couldn't load this chart" + retry) so one failure never blanks a dashboard. 404 page with search field and links to Data, Map, Publications. Export job failures show a toast with retry; timeouts after 60 s say "The export is taking longer than usual — we'll keep trying" and keep polling in the background up to 5 min.

**Offline:** service worker (Serwist) precaches the shell, fonts, tokens, logo and the home page; runtime cache stale-while-revalidate for `GET` API calls (max 200 entries, 7 days) and TopoJSON (cache-first). Offline banner at top: "You're offline — showing data saved on {date}". Forms (feedback, newsletter) queue with Background Sync and confirm when sent. Admin never serves cached data for submissions; only the entry grid drafts work offline.

**Motion:** durations `--onn-dur-1/2/3` (120/220/360 ms), easing `--onn-ease`. Drawers and sheets slide; dropdowns fade + 4px translate; tabs crossfade content 120ms; KPI values do not count up (avoid misreading); chart first render 400ms. Everything above is disabled or reduced to opacity-only under `prefers-reduced-motion: reduce`, and in Lite mode.

## 9. Languages, accessibility, performance

**i18n:**

- `next-intl` with messages per app in `messages/{locale}.json`, namespaced by page; ESLint rule forbids string literals in JSX.
- Locale routing `/fr/…`, `/en/…`, `/wo/…` from `locales.enabled`; root `/` redirects by `Accept-Language`, else default; switcher keeps path and query; choice stored in a cookie.
- Content from the API arrives localised; if a field is missing in the active locale the API sends the default-locale text with `fallback: true` and the UI adds a small "Not yet translated" badge.
- Local languages with limited written use (e.g. Wolof): UI chrome, home, KPI labels and help text must exist; long metadata may fall back.
- Plural and number rules via ICU messages; never concatenate translated fragments.
- `dir` attribute from `locales.rtl` (none for current West African configs, but layouts use logical properties `margin-inline-start` etc. so RTL works).

**Accessibility (WCAG 2.2 AA):** landmarks and one h1 per page; skip link "Skip to content"; focus ring `--onn-focus` on every interactive element; touch targets ≥ 44 × 44 px; contrast ≥ 4.5:1 text, 3:1 UI and chart marks against background; all data reachable without the mouse (map list view, chart table view); live region announces filter changes ("Showing Internet users, Dakar, 2015–2025"); forms with visible labels, inline errors linked by `aria-describedby`, error summary at top on submit; text zoom to 200% without horizontal scroll at 320px width.

**Low bandwidth and entry-level phones (target: Android Go, 360 × 640, 2 GB RAM, Slow 4G/3G):**

- Public pages readable with JavaScript disabled (SSR text, SSR SVG charts and map).
- **Lite mode** (toggle in footer; auto-on when `navigator.connection.saveData` is true or `effectiveType` is `2g`/`3g`; stored in a cookie so the server renders it): no MapLibre (SVG map only), no chart hydration (static SVG + table), no images except logos, tables shown before charts.
- Code-split MapLibre, ECharts modules, KaTeX, Tiptap, Scalar — none in the home bundle.
- Images via `next/image` AVIF/WebP with explicit sizes; covers lazy.

**Budgets (fail CI if exceeded; Lighthouse mobile, Slow 4G, Moto G Power profile):**

| Metric | Budget |
| --- | --- |
| LCP (home, explorer, indicator, map) | < 2.5 s (ToR ceiling 3 s on 3G) |
| CLS | < 0.1 |
| INP | < 200 ms |
| First-load JS, home | ≤ 170 KB gzipped |
| First-load JS, indicator page | ≤ 230 KB gzipped (ECharts core + line) |
| Map page JS after interaction | ≤ 320 KB gzipped (MapLibre) |
| Home total transfer, first visit | ≤ 900 KB |
| Fonts | ≤ 2 files, ≤ 90 KB total |
| adm1 TopoJSON | ≤ 150 KB |
| Lighthouse performance / accessibility / best practices / SEO | ≥ 90 / 100 / 100 / 100 |

**SEO:** sitemap per locale (indicators, publications, news, pages), `robots.txt` disallowing `/admin` and `/embed`, JSON-LD `Dataset` on indicator pages (name, description, temporalCoverage, spatialCoverage, license, creator, distribution with CSV URL) and `Report` on publications.

## 10. Tests and acceptance

**Test layers:**

- Unit (Vitest): formatters, URL-state parsing, classification breaks, trend/status calculation, token contrast derivation.
- Component (Testing Library + Storybook interaction tests): every component state listed in section 6.
- E2E (Playwright, Chromium + WebKit + a Pixel 5 emulation, against MSW): the user journeys below, each with an axe scan.
- Visual regression on Storybook stories (Playwright screenshots) at 360, 768 and 1280px.
- Lighthouse CI on home, `/data`, an indicator page, `/map`, a dashboard.

**Journeys that must pass:**

- [ ] Home → pick "Internet users" in the selector → indicator page shows chart, table and map tabs; change focus to a region and comparison to a peer group; copy the URL into a new context and get the identical view.
- [ ] Indicator page → switch to Sex disaggregation → download CSV; file contains exactly the plotted series.
- [ ] Map → switch to department level → play years → tap a department on a 360px viewport → bottom sheet opens at peek, drags to half; "Set as focus" updates the URL.
- [ ] Dashboard → Present → navigate slides with keyboard and swipe → Esc returns to the same scroll position.
- [ ] Query → choose 3 indicators, 2 areas, 2018–2025 → preview shows the right row count → copied API URL returns the same rows from the mock.
- [ ] Switch locale fr → en → wo on an indicator page; path and filters persist; no untranslated UI keys (a test fails on any missing message).
- [ ] Lite mode on (emulated `saveData`): map page shows SVG only; no MapLibre request in the network log.
- [ ] Offline (Playwright `context.setOffline`) after one visit: home and last viewed indicator render with the offline banner.
- [ ] Admin: contributor imports a file with 5 seeded errors → sees all 5 at row level → fixes → submits; editor verifies; a different admin approves and publishes; the same admin cannot approve their own submission; the new value appears on the portal mock.
- [ ] Admin: build a dashboard with 3 widgets via drag-and-drop, publish, open it on the portal.

**Done when:**

- [ ] Changing `NEXT_PUBLIC_COUNTRY` from `SEN` to `TGO` (with its config, TopoJSON and fixtures) changes names, colours, logos, languages, map levels, institutions and peer groups with zero component edits.
- [ ] Setting `NEXT_PUBLIC_API_BASE` to a real backend implementing section 3 works without code changes.
- [ ] Every number on every page shows source and year and links to its metadata.
- [ ] All budgets in section 9 pass in CI; axe reports zero serious/critical issues.
- [ ] Storybook is published as a static build with every component and state.
- [ ] `README.md` explains setup, adding a country (config, TopoJSON from official admin boundaries, fixtures), adding a locale, and connecting the real API.

## Sources

- [ITU DataHub](https://datahub.itu.int/) — selector pattern, explorer, catalogue, query and dashboard structure (viewed 7 Nov 2026).
- [PAENS — ToR, ONN Senegal platform rebuild](https://paens.sn/termes-de-reference-refonte-site-web-observatoire-national-du-numerique/) — visualisation, multilingual, performance and device requirements (published 6 Aug 2026).
