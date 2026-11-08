# API contract changes

Changes to the contract in `onn-frontend-prompt.md` §3, for the backend team. `packages/api-client/types.ts` is the current contract. Each change exists because a screen in the brief needs data the original contract doesn't provide.

## Fields added

| Type | Field | Needed by |
| --- | --- | --- |
| Localised responses | `fallback?: boolean` | §9 "Not yet translated" badge |
| `Pillar` | `description` | §5.2 country profile |
| `IndicatorSummary` | `synonyms` | §4.2 selector type-ahead |
| `IndicatorSummary` | `source`, `intlRefs` (moved from `Indicator`) | §5.8 catalogue columns |
| `latest` | `status`, `sparkline` (up to 10 values) | §6 `KpiCard`, without one `/series` call per card |
| `NewsItem` | `body` | §5.9 news detail page |
| `Benchmark` | `history`, `retrievedAt` | §5.6 slope chart and peer data note |

## Query parameters added

| Endpoint | Parameters | Needed by |
| --- | --- | --- |
| `GET /indicators` | `source`, `periodicity`, `status`, `subnational`, `pageSize` | §5.8 catalogue facets |
| `GET /indicators` | `area` | §5.2 area profile: `latest` for that area |
| `GET /data`, `GET /data/latest` | `level` | §5.4 map values for a whole level |
| `GET /data` | `pageSize` | §5.7 query preview |
| `GET /areas`, `GET /publications`, `GET /news` | `q` | §4.1 command palette |
| `GET /series`, `GET /data` | `dims=key:*` | §5.3 one series per category |
| `GET /data/latest` | `unit` | §5.3 map view in the selected unit variant |
| `GET /indicators` | `area` (latest values for that area) | §5.2 area profile |
| `POST /exports` | `resource: "profile"`, `params.area` | §5.2 "Download profile (PDF)" |
| `POST /exports` | `resource: "dashboard"`, `params.slug`, formats `pdf` and `pptx` | §5.5 dashboard Export menu |
| `POST /exports` | `resource: "catalogue"`, format `xlsx`, `params` `q`, `pillar`, `source` (organisation name), `periodicity`, `status`, `sub` (`yes`/`no`) as comma lists, and `columns` | §5.8 catalogue "Export XLSX" (the mock returns CSV) |
| `GET /publications` | `pageSize` | §5.9 12 cards per page |

## Values added

`indicator`, `area` on `/series` and `/data` accept comma-separated lists (§5.7). `area` on `/series` also accepts an ISO3 code or `peer:GROUP` (§4.4 comparison), where `peer:GROUP` returns the group median.

`GET /data` also accepts peer economies (ISO3) and `peer:GROUP` in `area`, returning their totals (the group median for a group), so the §5.7 query tool can mix national, sub-national and peer data in one download.

`GET /areas` also returns peer economies (`level: "country"`, `iso3` set) and peer groups (`level: "group"`, code `peer:GROUP`), for the §4.2 comparison field.

## Response types defined

The brief lists these endpoints without a response shape: `GET /home` (`HomeData`), `GET /targets` (`Strategy`), `GET /index` (`IndexScore`), and `GET /exports/{jobId}` (`ExportJob`).

## Endpoints added

| Endpoint | Needed by |
| --- | --- |
| `GET /pages/{slug}` → `CmsPage` | §5.9 about, methodology, partners and legal pages |
| `GET /datasets` → `Dataset[]` | §5.9 open data page |
| `POST /api-keys` | §5.9 "Get an API key" form |

## Boundaries

`GET /areas/{code}/geometry` returns one TopoJSON object named `areas` whose geometries carry the area `code` (config `geography.codeProperty`) and `name`; area codes must match `GET /areas`. The mock serves geoBoundaries stand-ins (Senegal 2019: 14 regions, 45 departments, so no Keur Massar; Togo 2017: 5 regions, 37 prefectures), and the mock area lists follow those files. Official files from the national statistics office replace them, along with the area list.

The config has a new `geography.boundaries` key (`attribution`, `url`, `official`) for the credit under every map; `official: false` adds a "not official boundaries" note.

## Still to define

Admin types, with their screens in Phase 7.
