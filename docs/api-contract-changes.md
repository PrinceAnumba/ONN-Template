# API contract changes

Changes to the contract in `onn-frontend-prompt.md` §3, for the backend team. `packages/api-client/types.ts` is the current contract. Each change exists because a screen in the brief needs data the original contract doesn't provide.

## Fields added

| Type | Field | Needed by |
| --- | --- | --- |
| Localised responses | `fallback?: boolean` on each object whose own text fell back (list items too, not only the page) | §9 "Not yet translated" badge |
| `Pillar` | `description` | §5.2 country profile |
| `IndicatorSummary` | `synonyms` | §4.2 selector type-ahead |
| `IndicatorSummary` | `source`, `intlRefs` (moved from `Indicator`) | §5.8 catalogue columns |
| `latest` | `status`, `sparkline` (up to 10 values) | §6 `KpiCard`, without one `/series` call per card |
| `NewsItem` | `body` | §5.9 news detail page |
| `Benchmark` | `history`, `retrievedAt` | §5.6 slope chart and peer data note |
| `IndicatorSummary` | `nextRelease` (`YYYY-MM`, moved from `Indicator`) | §5.9 release calendar without one call per indicator |
| `CmsBlock` | `partners: { name, url?, logo? }[]` | §5.9 partner grid block |

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
| `POST /api-keys` | §5.9 "Get an API key" form; 422 `Problem` with `errors[].path` per field |
| `GET /datasets/{code}/file?format=csv\|json` | §5.9 dataset downloads; `Dataset.url` points here and `ALL` is the full dump |
| `GET /openapi.json` | §5.9 developers page (Scalar). The mock serves `packages/mocks/openapi.ts`, which describes the contract |

`POST /feedback` returns a 422 `Problem` with `errors[].path` (`rating`, `message`, `email`) for invalid input, so the form can mark the right field. `FeedbackInput` has an optional `errorId`: the error page's "Report a problem" link (§8) passes the id it shows, which for a server error is the Next.js digest that also appears in the server log. `GET /news` and `GET /publications` accept `pageSize`. The mock also serves placeholder SVGs for `NewsItem.imageUrl` and CMS image blocks; the backend serves real files.

## Boundaries

`GET /areas/{code}/geometry` returns one TopoJSON object named `areas` whose geometries carry the area `code` (config `geography.codeProperty`) and `name`; area codes must match `GET /areas`. The mock serves geoBoundaries stand-ins (Senegal 2019: 14 regions, 45 departments, so no Keur Massar; Togo 2017: 5 regions, 37 prefectures), and the mock area lists follow those files. Official files from the national statistics office replace them, along with the area list.

The config has a new `geography.boundaries` key (`attribution`, `url`, `official`) for the credit under every map; `official: false` adds a "not official boundaries" note.

## Back office (§7)

The brief names the admin endpoints per screen but defines no types. These are the frontend's definitions, added batch by batch in Phase 7; types are in `packages/api-client/types.ts` and calls in `packages/api-client/admin.ts`.

**Authentication.** Every `/admin/*` request carries `Authorization: Bearer <token>`. The frontend will get the token from Auth.js (OIDC); the mock reads it as a demo user id. Answer `401` with a `Problem` when the token is missing or expired; the admin then shows sign-in. Admin responses must not be cached.

**Rights.** `packages/api-client/permissions.ts` lists which role may do what (an assumption awaiting confirmation). The backend should refuse the same actions with `403`; the admin hides them.

| Endpoint | Returns | Needed by |
| --- | --- | --- |
| `GET /admin/me` | `AdminMe`: user, roles, organisations (localised names), MFA status | §4.5 shell, org switcher, role-aware screens |
| `GET /admin/overview?org=` | `AdminOverview`: tasks (to verify, to approve, returned to me), deadlines in the next 30 days, quality pass rate, connector failures, latest feedback, 30 days of site usage, scoped to `org` or all of the user's organisations | §7 dashboard |
| `GET /admin/notifications` | up to 20 `AdminNotification`s, newest first: `kind` (`verify`, `approve`, `returned`, `deadline`, `connector`, `feedback`), `subject`, `href` (admin path), `date`, `read` | §4.5 notifications bell. The admin writes the sentence from `kind` and `subject`, so the backend sends no display text |
| `POST /admin/notifications/read` | body `{ ids: string[] }` | §4.5 "Mark all as read" |
| `GET /admin/demo-users` | `DemoUser[]` | Mock only: the demo role switcher. Not for the real API |

Public `POST /feedback` submissions should appear in the admin feedback inbox (`FeedbackItem`, with `status` New / Planned / Done / Won't do).

### Submissions and the workflow (Phase 7b)

| Endpoint | Returns | Needed by |
| --- | --- | --- |
| `GET /admin/submissions?status=&q=&org=&channel=&from=&to=&page=&pageSize=` | `SubmissionPage`: a `Page<SubmissionSummary>` plus `counts` per status for the same filters without `status` (the tab counts). `q` matches id, organisation, indicator codes and names, and submitter; `from`/`to` filter the last update (YYYY-MM-DD, inclusive); `pageSize` is 25, 50 or 100. Only the user's organisations | §7 submissions list |
| `GET /admin/submissions/:id` | `SubmissionDetail`: summary fields plus `rows` (each with the currently `published` value or null, and the rules it breaks), `quality` (one `QualityResult` per rule, with `rowIds` and any `justification`), `history` (`SubmissionEvent`s with actor, from/to status and comment) and `verifiedBy`. `404` outside the user's organisations | §7 detail: Data, Quality, Diff, History tabs |
| `POST /admin/submissions/:id/transition` | body `TransitionInput` `{ action, comment? }`; returns the updated `SubmissionDetail` | §7 action bar |
| `POST /admin/submissions/bulk-transition` | body `{ ids (≤ 100), action, comment? }`; returns `BulkTransitionResult` `{ done: id[], failed: { id, status, detail }[] }`. Each id is checked as if sent alone; one refusal doesn't stop the others | §7 bulk-action bar |
| `PUT /admin/submissions/:id/justifications` | body `{ [rule]: text }` for failing warnings; returns `SubmissionDetail` | §7 Quality tab |
| `GET /admin/calendar?month=YYYY-MM&org=` | `CalendarItem[]` with deadlines in that month: `status` `upcoming`, `received` or `overdue` | §7 collection calendar |

**Transitions.** `submit` from draft or returned; `verify` from submitted; `approve` from verified; `publish` from approved; `return` from submitted, verified or approved (back to returned). Refusals are a `Problem` whose `type` the admin turns into a message:

| `type` | Status | When |
| --- | --- | --- |
| `role` | 403 | the role may not take this action (`permissions.ts`) |
| `scope` | 403 | the submission belongs to an organisation the user isn't in |
| `state` | 409 | the action isn't allowed from the current status (e.g. someone else moved it first) |
| `own-submission` | 409 | approving a submission you submitted (§7: an approver must not approve their own) |
| `errors` | 422 | submitting while a quality rule at error level fails |
| `unjustified` | 422 | verifying while a failing warning has no justification |
| `comment` | 422 | returning without a comment |

**Quality rules** (`QualityRule`): `missing` (null value, error), `negative` (error), `range` (percentage outside 0–100, error), `duplicate` (same indicator, area, period and breakdown, error), `jump` (over 30% from the published or previous value, warning). The backend may add rules; the admin needs a message for each new code.

**Publish webhook.** Publishing must update the public endpoints and call each frontend's `POST /api/revalidate` with header `X-Revalidate-Secret` and body `{ tags: string[] }` (at most 100). The portal answers `401` on a wrong secret. The mock sends `indicator:<code>` for each published indicator plus `home`, `selector`, `profile`, `map`, `benchmark`, `query`, `catalogue`, `dashboards` and `datasets`; the URLs and secret come from `REVALIDATE_URLS` (comma-separated) and `REVALIDATE_SECRET`.

### File imports and manual entry (Phase 7c)

Both end in an ordinary submission (`channel` `import` or `entry`), so verification, approval and publishing work as above.

| Endpoint | Returns | Needed by |
| --- | --- | --- |
| `GET /admin/imports?org=&page=&pageSize=` | `Page<ImportSummary>` | Imports list |
| `GET /admin/imports/template?org=` | CSV with `indicator,area,period,value,flag` and one row per indicator and area the organisation reports, for the next period. The mock also takes `demo=errors` (values with five seeded errors); the real API needn't | §7 "Download template per indicator set" (the set is the organisation's indicators) |
| `POST /admin/imports` | multipart `file` (CSV, XLSX, JSON or XML, ≤ 50 MB) and `org`; `201` with an `ImportJob` in `parsing`. `413` over 50 MB, `415` for other formats, `403` for roles that can't submit | Upload step |
| `GET /admin/imports/:id` | `ImportJob`, polled while `parsing` or `validating`. After parsing: `columns` (header, suggested `target`, `auto`), `targets` (fields a column can map to, including `dim:<key>` breakdowns the organisation's indicators use) and `preview` (first 20 rows). After validation: `counts`, `issues` (row, field, rule, level, cell value) and `rows`. `failed` carries `error`: `format`, `empty` or `unsupported` | Map, Validate steps |
| `PUT /admin/imports/:id/mapping` | body `{ columns: { [header]: ImportField } }`; starts validation. `422` with `type: "mapping"` when indicator, area, period or value is unmapped or a field is mapped twice | Map step |
| `PATCH /admin/imports/:id/rows` | body `{ fixes?: ImportFix[], remove?: number[] }`; fixes cells or drops rows (row numbers stay stable) and validates again at once | Validate step: fixing errors in place (§10 journey "fixes → submits") |
| `POST /admin/imports/:id/submit` | body `{ comment? }`; `201` with `{ submission }`, a new submission in `submitted` holding the valid rows. `422` `type: "errors"` while errors remain | Submit step |
| `GET /admin/entry?org=` | `EntryIndicator[]`: indicators the user's organisations report, with the next period and any open entry draft | Data entry list |
| `GET /admin/entry/:indicator?period=` | `EntrySheet`: three periods ending at `period` (default: the next one), rows for the national level, regions with data and each published breakdown, the draft's or published values, the value before the first column, and `locked` once the draft has been submitted | Entry grid |
| `PUT /admin/entry/:indicator?period=` | body `{ cells: EntryCell[] }`; saves into the entry draft for that organisation, indicator and period (created on first save). Cells equal to the published value are dropped. `409` `type: "state"` once submitted | Entry grid autosave |

**Import rules** (`ImportRule`) add to the quality rules: `indicator` (unknown code), `area` (unknown code), `period` (wrong format for the indicator's periodicity), `number` (text in a value cell) and `permission` (an indicator the organisation doesn't report). The admin needs a message for any new code.

**Shared checks.** `packages/api-client/quality.ts` (`valueIssues`, `parseNumber`, `validPeriod`) is what the entry grid runs while typing; the backend's rules should match it (30% jump threshold, percentages ≤ 100, both decimal conventions).

### Connectors, quality and the indicator referential (Phase 7d)

| Endpoint | Returns | Needed by |
| --- | --- | --- |
| `GET /admin/connectors?org=` | `ConnectorSummary[]`: type, cron `schedule`, `enabled` and the last run (date, status, rows, error) | Connectors list |
| `GET /admin/connectors/:id` | `Connector`: adds `endpoint`, `auth` (`none`, `token`, `basic`; secrets are never returned), `sourceFields`, `mapping` (source field → `ImportField`), `targets` and the last 20 `runs` with their log | Connector detail |
| `POST /admin/connectors`, `PUT /admin/connectors/:id` | body `ConnectorInput`; `Connector`. `422` `type: "validation"` with `errors[]` (`path`: `name`, `org`, `type`, `endpoint`, `auth`, `schedule`, `mapping.<field>` or `mapping.<index>`; `message`: `required`, `scheme`, `cron`, `length`, `duplicate`, `unknown`) | Settings form, field mapping |
| `POST /admin/connectors/test` | body `{ type, endpoint, auth, org? }` (unsaved settings, so a new connector can be tested); `ConnectorTestResult`: `ok`, `latencyMs`, the sample's `fields`, and with `org` the `targets` and a `suggested` mapping. Failures: `error` `unreachable` (with the source's `detail`), `auth` or `scheme` | "Test connection" |
| `POST /admin/connectors/:id/dry-run` | body `{ mapping? }` (may be unsaved); `ConnectorDryRun`: `total`, the first 50 mapped `rows` and how many would fail a quality rule. `422` `mapping`, `502` `unreachable` | "Dry run" |
| `POST /admin/connectors/:id/run` | `201` `ConnectorRun`. A successful run creates a `submitted` submission (`channel: "connector"`) and names it in `submission`; a failed one is recorded with its `error` and log | "Run now", run history |
| `GET /admin/quality?org=` | `QualityOverview`: pass rate now and 30 days ago, rows checked, rates `byOrg`, `byIndicator` (lowest first) and `byMonth` (last six months, by submission date), and `warnings` (unjustified warnings in submissions not yet published) | Quality |
| `GET /admin/indicators?q=&status=&pillar=&sort=code\|priority&page=&pageSize=` | `Page<IndicatorAdminSummary>` with the prioritisation `priority` (mean of four 1–5 scores) | Indicators list |
| `GET /admin/indicators/:code` | `IndicatorAdmin`: an `IndicatorRecord` with every text as `Localised` (`{ [locale]: string }`, not resolved to one language, so the editor shows them side by side), plus `thresholds`, `goalposts`, `priority`, `org`, the version and its history (`note`, `author`, changed fields) | Indicator editor |
| `POST /admin/indicators` | body `IndicatorCreateInput` (`code`, `name`, `pillar`, `theme`, `org`); `201` `IndicatorAdmin` as `planned`, version 1. `422` `validation` (`code` `format` or `duplicate`) | New indicator |
| `PUT /admin/indicators/:code` | body `{ indicator: IndicatorRecord, note }`; saves version n+1 and records which top-level fields changed. `422` `validation` (paths such as `name.fr`, `goalposts.max`, `intlRefs.0.url`, `note`; messages `required`, `format`, `order`, `range`, `duplicate`, `unknown`), `422` `unchanged` when nothing differs. The public `/indicators` metadata reflects the save, and the backend should call the portal's revalidation (`indicator:<code>` and the catalogue tags) as it does on publish | Indicator editor (§7 "save creates a new version with a note") |

**Changed:** `AdminOverview.quality` is now computed the same way as `GET /admin/quality` (rows with no error and every warning justified), and `openWarnings` counts unjustified warnings rather than open submissions.

**Rights** (`permissions.ts`): `connector.manage` (create, edit, test, run: admins), `indicator.view` (admins and editors) and `indicator.edit` (admins). Editors see connectors and indicators read-only; dry runs only need `connector.view`.

**Cron.** Schedules are five-field cron expressions in the country's time zone (`config.timezone`); `packages/api-client/cron.ts` is the parser both sides use (numbers, `*`, lists, ranges and steps; no names).

### Dashboards builder, publications and reports (Phase 7e)

Back-office text is `Localised` (`{ [locale]: string }`), as for indicators. `ContentStatus` is `draft` (never published), `published` or `changed` (live, with unpublished edits). Validation failures are `422` `type: "validation"` with `errors[]` field paths.

| Endpoint | Returns | Needed by |
| --- | --- | --- |
| `GET /admin/dashboards` | `DashboardAdminSummary[]` (title in the request language, audience, widget count, status) | Dashboards list |
| `POST /admin/dashboards` | body `DashboardCreateInput` (`slug`, `title`, `audience`); `201` `DashboardAdmin` as a draft with no widgets. Errors: `slug` `format`/`duplicate` | New dashboard |
| `GET /admin/dashboards/:slug`, `PUT /admin/dashboards/:slug` | `DashboardAdmin`: `DashboardRecord` (title, description, audience, `AdminWidget[]` with `Localised` title and body) plus status. PUT saves the draft; paths such as `widgets.2.indicators` (`required`, `count`: one indicator except line and table, up to 4), `widgets.0.title.fr`, `widgets.1.span` (`range`), `years` (`format`, `order`), `area`/`compare` (`unknown`) | Builder |
| `POST /admin/dashboards/:slug/publish`, `…/unpublish` | `DashboardAdmin`. Publish validates again and refuses an empty dashboard (`422` `empty`); both update the public `/dashboards` and revalidate `dashboards`, `dashboard:<slug>` and `home` | Publish / unpublish |
| `GET /admin/publications` | `PublicationAdminSummary[]` with `signature` (`pending`, `signed`, `failed`) and `published` | Publications list |
| `POST /admin/publications` | multipart: `file` (PDF, ≤ 50 MB), optional `cover` (PNG, JPEG or WebP, ≤ 2 MB) and `meta` (JSON `PublicationRecord` + `slug`); `201` `PublicationAdmin` with `signature: "pending"`. The backend signs the PDF and moves it to `signed` or `failed`. Periods: `YYYY-Qn` for quarterly, `YYYY` for annual | New publication |
| `GET /admin/publications/:slug`, `PUT /admin/publications/:slug` | `PublicationAdmin` (adds `fileName`, `fileBytes`, `signedAt`, and `fileUrl`/`coverUrl` under `/admin`). PUT takes `PublicationRecord` as JSON; when published, the public entry updates at once | Publication detail (the page polls while `pending`) |
| `POST /admin/publications/:slug/files` | multipart `file` and/or `cover`. A new PDF goes back to `pending`. `409` `published` while live, so the portal never offers an unsigned file | Replace file |
| `GET /admin/publications/:slug/file`, `…/cover` | The stored PDF and cover | Detail page |
| `POST /admin/publications/:slug/publish`, `…/unpublish` | `PublicationAdmin`. Publish needs `signed` (`409` `unsigned`); the public `verified` flag is the signature. Revalidates `publications`, `publication:<slug>` and `home` | Publish |
| `GET /admin/reports`, `POST /admin/reports` | `ReportSummary[]` (block count, open comments); POST takes `{ template: "quarterly" \| "annual", period, title }` and returns `201` `ReportAdmin` with the template's blocks | Reports list, new report |
| `GET /admin/reports/:id`, `PUT /admin/reports/:id` | `ReportAdmin`: title, period, ordered `ReportBlock[]` (`text` with `html`, `assignee` and `comments`; `kpis` up to 6 indicators; `chart` indicator, area, years; `map` indicator, year; `table` up to 4 indicators, years) and `people` who can be assigned. PUT ignores `comments` in the body (they have their own endpoints) and keeps each block's thread by id | Report builder |
| `POST /admin/reports/:id/blocks/:block/comments`, `PATCH …/comments/:comment` | `201` `ReportComment`; PATCH `{ resolved }` | Comments on text blocks |
| `POST /admin/reports/:id/exports`, `GET /admin/exports/:job`, `GET /admin/exports/:job/file` | body `{ format: "pdf" \| "docx" }`; `202` `{ jobId }`. The job is an `ExportJob`, now with an optional `progress` (0–1) and a `url` under `/admin`. Admin-scoped because a draft report isn't public | "Generate PDF / DOCX" |

**Changed:** `ExportFormat` adds `docx`; `ExportJob.progress` is optional for every export. `content.edit` (super admin, admin, editor) covers all of the above.

**Preview without publishing.** The admin previews draft widgets through the portal's `/[locale]/embed/preview?d=`, which carries the widgets in the URL (`@onn/api-client/preview`, base64url JSON, validated and capped at 24 widgets). No backend endpoint is involved; the portal fetches only public data.

### News, pages, alerts and newsletter (Phase 7f)

Types are in `packages/api-client/types.ts` (Phase 7f sections). Validation failures are `422` `validation` with `errors[]` paths, as in 7e.

| Endpoint | Returns | Needed by |
| --- | --- | --- |
| `POST /admin/media` | multipart `image` (PNG, JPEG, WebP, ≤ 2 MB); `201` `MediaUpload` with a public `url` (`GET /media/:id`) | News picture, CMS image blocks |
| `GET /admin/news?q=&status=&kind=&page=&pageSize=`, `POST /admin/news` | `Page<NewsAdminSummary>`; POST takes `NewsCreateInput`, returns a draft `NewsAdmin`. `body` is HTML | News list, editor |
| `GET/PUT /admin/news/:slug` | `NewsAdmin`; saving a published item updates the portal at once | Editor |
| `POST /admin/news/:slug/publish` (`{ at? }`), `…/unpublish` | A future `at` gives `scheduled` with `publishAt`; revalidates `news`, `news:<slug>`, `home` | Publish, schedule |
| `GET /admin/news-watch?status=`, `PUT /admin/news-watch/settings`, `POST /admin/news-watch/:id/approve\|reject\|restore\|draft` | `WatchQueue` (items, counts, settings); `WatchSettings`; `WatchItem`. Approve publishes a `watch` news item; `draft` creates one to edit | Watch queue |
| `GET /admin/pages`, `GET/PUT /admin/pages/:slug`, `POST …/publish` | `PageAdminSummary[]`, `PageAdmin` (`PageBlock[]`, `Localised` text, Markdown bodies) with `ContentStatus`; publish revalidates `page:<slug>` | Pages |
| `GET/PUT /admin/pages/home`, `POST /admin/pages/home/publish` | `HomeModulesAdmin` (chips, featured, map and benchmark indicators); publish revalidates `home` | Home modules |
| `GET/POST /admin/alerts`, `GET/PUT/DELETE /admin/alerts/:id`, `GET /admin/alerts/events?rule=&page=&pageSize=` | `AlertRules` (rules and `people`), `AlertRule`, `Page<AlertEvent>` | Alerts |
| `GET/POST /admin/newsletter`, `GET/PUT /admin/newsletter/:id`, `GET …/options`, `POST …/preview`, `POST …/:id/send` (`{ at? }`), `POST …/:id/unschedule`, `GET …/subscribers` | `CampaignSummary[]`, `Campaign`, `CampaignOptions`, `CampaignPreview` (the email HTML and audience size, for unsaved content), `Page<Subscriber>`. `409` `state` unless draft; `422` `empty` when nobody matches | Newsletter |

**Changed:** `SubscriberInput.topics` (optional pillar codes). New rights `alert.manage` and `newsletter.manage` (super admin, admin, editor); news and pages use `content.edit`.

### Users, organisations, feedback, audit log and settings (Phase 7g)

Types are in `packages/api-client/types.ts` (Phase 7g section). Validation failures are `422` `validation` with `errors[]` paths; new message codes are `email`, `phone`, `range` and `order`.

| Endpoint | Returns | Needed by |
| --- | --- | --- |
| `GET /admin/users?q=&status=&role=&org=&page=&pageSize=` | `UserPage`: a `Page<AdminUser>`, `counts` per status for the same search, and the `orgs` a user can be given. `status` is `invited` until the first sign-in | Users list |
| `POST /admin/users` | body `UserInviteInput` (`name`, `email`, `role`, `orgs`); `201` `AdminUser` as `invited`, and the backend sends the invitation. Errors: `email` `email`/`duplicate`, `role` `unknown`, `orgs` `required`/`unknown` | Invite |
| `GET /admin/users/:id`, `PUT /admin/users/:id` | `AdminUser`; PUT takes `UserUpdateInput` (the email doesn't change) | User detail |
| `POST /admin/users/:id/deactivate`, `…/reactivate`, `…/resend` | `AdminUser`. Deactivating ends the user's sessions. `409` `state` when it doesn't apply | User detail |
| `GET /admin/users/access-review` | CSV (UTF-8 with BOM, `Content-Disposition: attachment`): name, email, roles, organisations, status, MFA, last sign-in, invited | "Access review" export |
| `GET /admin/organisations` | `OrganisationAdminSummary[]` with counts of indicators, connectors and active users | Organisations list |
| `GET /admin/organisations/:code`, `PUT /admin/organisations/:code` | `OrganisationAdmin`: `OrganisationRecord` (`Localised` name and description, kind, website, up to 10 `OrgContact`s) plus the indicators it is the source of, its connectors and its users. PUT takes the record; paths such as `name.fr`, `website` (`url`), `contacts.0.email` | Organisation detail |
| `GET /admin/feedback?q=&status=&rating=&page=&pageSize=` | `FeedbackPage`: `Page<FeedbackAdminItem>` (adds `email`, internal `note`, `updated`) and `counts` per status | Feedback inbox |
| `PATCH /admin/feedback/:id` | body `{ status?, note? }`; the updated item | Message dialog |
| `POST /admin/feedback/bulk` | body `{ ids (≤ 100), status }`; `{ done: id[], failed: { id, status, detail }[] }` | Bulk-action bar |
| `GET /admin/audit?actor=&entity=&action=&from=&to=&page=&pageSize=` | `AuditPage`: `Page<AuditEntry>` newest first (`seq`, actor, `AuditAction`, `AuditEntity`, `entityId`, optional `before`/`after` JSON, `prevHash`, `hash`) and the `actors` in the log | Audit log |
| `POST /admin/audit/verify` | `AuditVerification` `{ ok, checked, brokenAt?, verifiedAt }`: the whole chain recomputed on the server | "Verify chain" |
| `GET /admin/settings`, `PUT /admin/settings` | `SettingsAdmin`: `overrides` (`RuntimeSettingKey` → string or `null` for the default), `features`, `quotas` per `QuotaTier`, with `defaults`, `featureDefaults`, read-only `smtp` and `sms` details and their `lastTest`. PUT takes `SettingsInput`; paths such as `overrides.exportMaxRows` (`range`), `quotas.0.perDay` (`range`, `order`) | Settings |
| `POST /admin/settings/test/smtp`, `…/test/sms` | body `{ to }`; `ChannelTest` `{ ok, date, detail? }`. A refused message is `200` with `ok: false` and the gateway's words; `422` only for a malformed `to` | SMTP/SMS test buttons |

**Rules the admin relies on** (Problem `type`): `role` (403) when a non-super-admin gives the super admin role or changes someone who has it; `self` (409) for changing your own role or deactivating yourself.

**Rights** (`permissions.ts`): `user.manage`, `org.manage` and `audit.view` (super admin, admin), `feedback.manage` (super admin, admin, editor), `settings.manage` (super admin).

**Audit.** The backend should record every admin write, with `before` and `after` where a record changed, and define the hash (the mock's is a stand-in). The frontend only displays `hash` and `prevHash` and asks the server to verify.

**Open questions for the backend:** which runtime settings exist (the four keys are a proposal), whether feature toggles should reach the portal at runtime (today `features` is build-time config), and whether organisations can be created outside the catalogue's sources.

**Changed:** `POST /feedback` keeps `email` for the inbox.

## Phase 8: behaviour the end-to-end tests rely on

No new endpoints. The journeys found two behaviours the backend must match:

- **Publishing extends coverage.** When a published value's period is past an indicator's `coverage.to` (or before `coverage.from`), the indicator's coverage must move to include it, and `lastUpdated` should change. The portal clamps its year range to `coverage`, so without this the latest-value card shows the new value but the chart and table stop a year short.
- **Public text is never an empty object.** A localised field left blank in the admin (for example a dashboard's description) must reach the public API as `""` (or the field must be omitted where the type allows it), never as `{}`. An object in place of text failed the portal page with a 500.
