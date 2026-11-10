// The contract from brief §3, plus the additions listed in docs/api-contract-changes.md.

export type Locale = string; // from config.locales.enabled
export type ObsStatus = "A" | "E" | "P" | "B" | "F" | "M"; // normal, estimate, provisional, break, forecast, missing

/** Set when a text field is missing in the requested locale and the default locale was sent. */
export interface MaybeFallback {
  fallback?: boolean;
}

export interface Pillar extends MaybeFallback {
  code: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  themes: Theme[];
  indicatorCount: number;
}
export interface Theme {
  code: string;
  name: string;
  indicatorCount: number;
}

export type Periodicity = "monthly" | "quarterly" | "annual" | "biennial";
export type IndicatorStatus = "published" | "in_collection" | "planned";
export type SourceMethod = "survey" | "administrative" | "computed" | "international";

export interface IntlRef {
  org: "ITU" | "WB" | "UN" | "AU";
  code: string;
  name: string;
  url: string;
}

export interface LatestValue {
  value: number;
  year: string;
  changePct?: number;
  status: ObsStatus;
  /** Up to 10 most recent values, oldest first, for KPI sparklines. */
  sparkline: (number | null)[];
}

export interface IndicatorSummary extends MaybeFallback {
  code: string;
  name: string;
  shortDefinition: string;
  synonyms: string[];
  pillar: string;
  theme: string;
  unit: string;
  unitVariants: { code: string; label: string }[];
  periodicity: Periodicity;
  geoLevels: string[]; // ["national","adm1","adm2"]
  disaggregations: string[]; // ["sex","age_group","area","operator"]
  higherIsBetter: boolean;
  isHeadline: boolean;
  source: { org: string; method: SourceMethod };
  intlRefs: IntlRef[];
  latest?: LatestValue;
  status: IndicatorStatus;
  lastUpdated: string; // ISO date
  nextRelease?: string; // YYYY-MM, for the release calendar
}
export interface Indicator extends IndicatorSummary {
  definition: string;
  computation?: string; // markdown, may contain $$LaTeX$$
  coverage: { from: string; to: string; areas: number };
  qualityNotes?: string;
  versions: { version: number; date: string; note: string }[];
  licence: string;
  related: string[];
  dashboards: { slug: string; title: string }[];
}

export type AreaLevel = "country" | "adm1" | "adm2" | "adm3" | "group";
export interface Area {
  code: string;
  level: AreaLevel;
  name: string;
  parent?: string;
  iso3?: string;
}
export interface Observation {
  indicator: string;
  area: string;
  period: string;
  dims: Record<string, string>;
  value: number | null;
  unit: string;
  status: ObsStatus;
  source: string;
  version: number;
}
export interface Series {
  indicator: string;
  area: string;
  dims: Record<string, string>;
  unit: string;
  points: { period: string; value: number | null; status: ObsStatus }[];
}
export interface PeerRow {
  area: string;
  name: string;
  value: number | null;
  year: string;
  rank: number;
}
export interface PeerStats {
  year: string;
  median: number;
  min: number;
  max: number;
}
export interface RankHistoryRow {
  area: string;
  name: string;
  year: string;
  rank: number;
}
export interface Benchmark {
  rows: PeerRow[];
  stats: PeerStats[];
  history: RankHistoryRow[];
  retrievedAt: string;
}

export interface Dashboard extends MaybeFallback {
  slug: string;
  title: string;
  description: string;
  audience: "decision" | "analyst" | "public";
  widgets: Widget[];
}
export interface Widget {
  id: string;
  type:
    | "kpi"
    | "line"
    | "bar"
    | "stacked"
    | "donut"
    | "radar"
    | "treemap"
    | "map"
    | "table"
    | "target"
    | "text";
  title: string;
  indicators: string[];
  area?: string;
  compare?: string;
  years?: string;
  dims?: Record<string, string>;
  span: 1 | 2 | 3;
  body?: string;
}
export interface Publication extends MaybeFallback {
  slug: string;
  type: "quarterly" | "annual" | "study" | "method";
  title: string;
  summary: string;
  date: string;
  pillar?: string;
  coverUrl: string;
  fileUrl: string;
  fileBytes: number;
  verified: boolean;
}
export interface NewsItem extends MaybeFallback {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  date: string;
  tags: string[];
  kind: "news" | "watch";
  sourceUrl?: string;
  imageUrl?: string;
}

export interface HomeData extends MaybeFallback {
  mission: string;
  lastUpdated: string;
  exampleChips: { label: string; href: string }[];
  featuredIndicators: string[];
  mapTeaserIndicator: string;
  benchmarkIndicator: string;
  partners: { name: string; logo: string; lastSubmission: string }[];
}
export interface Target {
  indicator: string;
  name: string;
  unit: string;
  target: number;
  targetYear: string;
}
export interface Strategy extends MaybeFallback {
  name: string;
  targets: Target[];
}
export interface IndexScore extends MaybeFallback {
  year: string;
  score: number;
  pillars: { code: string; name: string; score: number }[];
}

export interface CmsBlock {
  type: "richText" | "image" | "callout" | "table" | "partners";
  body?: string;
  src?: string;
  alt?: string;
  rows?: string[][];
  /** Partner grid (`partners` blocks). */
  partners?: { name: string; url?: string; logo?: string }[];
}
export interface CmsPage extends MaybeFallback {
  slug: string;
  title: string;
  blocks: CmsBlock[];
}
export interface Dataset extends MaybeFallback {
  code: string;
  title: string;
  description: string;
  pillar?: string;
  formats: string[];
  licence: string;
  updateFrequency: string;
  lastUpdated: string;
  url: string;
}

export interface Page<T> {
  items: T[];
  meta: { total: number; page: number; pageSize: number };
}
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { path: string; message: string }[];
}

export type ExportFormat = "pdf" | "pptx" | "xlsx" | "docx";
export interface ExportRequest {
  format: ExportFormat;
  resource: string;
  params?: Record<string, string>;
}
export type ExportStatus = "queued" | "running" | "done" | "failed";
export interface ExportJob {
  status: ExportStatus;
  /** 0–1 while queued or running, when the server knows it. */
  progress?: number;
  url?: string;
}

export interface FeedbackInput {
  rating?: number;
  useful?: boolean;
  message?: string;
  email?: string;
  page: string;
  /** Set when the form was opened from an error page ("Report a problem", brief §8). */
  errorId?: string;
}
export interface SubscriberInput {
  email: string;
  locale: Locale;
  /** Pillar codes to follow; none means everything. */
  topics?: string[];
}
export interface ApiKeyInput {
  name: string;
  email: string;
  organisation: string;
  intendedUse: string;
  acceptedTerms: boolean;
}

// ---------------------------------------------------------------------------------------------
// Back office (brief §7). Every admin request carries `Authorization: Bearer <token>`; the mock
// server reads the token as a demo user id. Added by the frontend; see docs/api-contract-changes.md.

export type AdminRole = "super_admin" | "admin" | "editor" | "contributor" | "reader";

export interface Organisation {
  code: string;
  name: string;
  kind: "statistics" | "regulator" | "ministry" | "international" | "other";
}

/** `GET /admin/me`: who the bearer is, what they may do and for which organisations. */
export interface AdminMe {
  user: { id: string; name: string; email: string };
  roles: AdminRole[];
  orgs: Organisation[];
  mfa: boolean;
}

/** Demo users for the role switcher. Mock only: `GET /admin/demo-users`. */
export interface DemoUser {
  id: string;
  name: string;
  roles: AdminRole[];
}

export type SubmissionStatus =
  "draft" | "submitted" | "verified" | "approved" | "published" | "returned";
export type SubmissionChannel = "import" | "entry" | "connector";

export interface SubmissionSummary {
  id: string;
  org: string;
  orgName: string;
  indicators: string[];
  period: string;
  channel: SubmissionChannel;
  status: SubmissionStatus;
  submittedBy: { id: string; name: string };
  updated: string;
}

export interface CalendarItem {
  id: string;
  org: string;
  orgName: string;
  indicatorSet: string;
  period: string;
  deadline: string;
  status: "upcoming" | "received" | "overdue";
}

export interface AdminNotification {
  id: string;
  kind: "verify" | "approve" | "returned" | "deadline" | "connector" | "feedback";
  /** What the notification is about (a submission id, organisation or connector name); the UI
   * writes the sentence from its own messages. */
  subject: string;
  /** Admin path without the `/admin` base path, e.g. `/submissions/SUB-0012`. */
  href: string;
  date: string;
  read: boolean;
}

export interface FeedbackItem {
  id: string;
  date: string;
  rating?: number;
  useful?: boolean;
  message?: string;
  page: string;
  errorId?: string;
  status: "new" | "planned" | "done" | "wont_do";
}

/** `GET /admin/overview`: data for the dashboard cards, scoped to the bearer's organisations. */
export interface AdminOverview {
  tasks: {
    verify: SubmissionSummary[];
    approve: SubmissionSummary[];
    returned: SubmissionSummary[];
  };
  deadlines: CalendarItem[];
  quality: { passRate: number; previous: number; openWarnings: number };
  connectorFailures: { id: string; name: string; lastRun: string; error: string }[];
  feedback: FeedbackItem[];
  usage: { date: string; visits: number }[];
}

/** One value in a submission (brief §7 submission detail, *Data* and *Diff* tabs). */
export interface SubmissionRow {
  id: string;
  indicator: string;
  indicatorName: string;
  area: string;
  areaName: string;
  period: string;
  dims: Record<string, string>;
  value: number | null;
  unit: string;
  status: ObsStatus;
  /** The value currently published for the same key; null when the submission adds it. */
  published: number | null;
  /** Rule codes this row breaks; see `QualityResult`. */
  issues: { rule: QualityRule; level: "error" | "warning" }[];
}

/** Validation rules. The admin writes each rule's explanation from its own messages. */
export type QualityRule = "missing" | "negative" | "range" | "jump" | "duplicate";

export interface QualityResult {
  rule: QualityRule;
  level: "error" | "warning";
  status: "pass" | "fail";
  /** Rows that break the rule. */
  rowIds: string[];
  /** Required for each failing warning before the submission can be verified. */
  justification?: string;
}

export type SubmissionAction = "submit" | "verify" | "approve" | "publish" | "return";

export interface SubmissionEvent {
  id: string;
  date: string;
  /** Absent for the event that created the submission. */
  from?: SubmissionStatus;
  to: SubmissionStatus;
  actor: { id: string; name: string };
  comment?: string;
}

/** `GET /admin/submissions/{id}`. */
export interface SubmissionDetail extends SubmissionSummary {
  rows: SubmissionRow[];
  quality: QualityResult[];
  history: SubmissionEvent[];
  /** Who verified it, when it has been verified. */
  verifiedBy?: { id: string; name: string };
}

/** `GET /admin/submissions`: a page plus the count for each status tab. */
export interface SubmissionPage extends Page<SubmissionSummary> {
  counts: Record<SubmissionStatus, number>;
}

export interface TransitionInput {
  action: SubmissionAction;
  /** Required for "return". */
  comment?: string;
}

export interface BulkTransitionResult {
  done: string[];
  failed: { id: string; status: number; detail: string }[];
}

// ---- File imports (§7 import wizard) ----

export type ImportFormat = "csv" | "xlsx" | "json" | "xml";
/** parsing → mapping (columns to confirm) → validating → validated → submitted; or failed. */
export type ImportStatus =
  "parsing" | "mapping" | "validating" | "validated" | "submitted" | "failed";
/** What a file column holds. `dim:<key>` is a breakdown such as `dim:sex`. */
export type ImportField =
  "indicator" | "area" | "period" | "value" | "flag" | "ignore" | `dim:${string}`;
/** Import checks beyond the quality rules: unknown codes, bad periods, text in value cells, and
 * indicators the organisation doesn't report. */
export type ImportRule = QualityRule | "indicator" | "area" | "period" | "number" | "permission";

export interface ImportColumn {
  /** The header as written in the file. */
  source: string;
  target: ImportField;
  /** True when the server matched the header itself. */
  auto: boolean;
}

export interface ImportIssue {
  /** 1-based data row in the file (the header is row 0). */
  row: number;
  field: ImportField;
  rule: ImportRule;
  level: "error" | "warning";
  /** The cell as read from the file. */
  value: string;
}

export interface ImportSummary {
  id: string;
  org: string;
  orgName: string;
  fileName: string;
  format: ImportFormat;
  bytes: number;
  status: ImportStatus;
  created: string;
  createdBy: { id: string; name: string };
  rowCount: number;
  counts?: { errors: number; warnings: number; valid: number };
  /** The submission created on submit. */
  submission?: string;
}

export interface ImportJob extends ImportSummary {
  columns: ImportColumn[];
  /** Fields a column can map to, including the breakdowns the organisation's indicators use. */
  targets: ImportField[];
  /** The first 20 data rows, cells in column order. */
  preview: string[][];
  /** Every data row once validated, for the row-level list and fixing cells. */
  rows?: string[][];
  issues?: ImportIssue[];
  /** Why parsing failed: `format` (unreadable), `empty`, or `unsupported` (a format this server
   * can't read yet). */
  error?: "format" | "empty" | "unsupported";
}

export interface ImportFix {
  row: number;
  field: ImportField;
  value: string;
}

// ---- Manual data entry (§7 entry grid) ----

export interface EntryIndicator {
  code: string;
  name: string;
  unit: string;
  periodicity: Periodicity;
  org: string;
  orgName: string;
  /** Latest published period, if any. */
  latest?: string;
  /** The period collected next. */
  next: string;
  /** An open entry draft for that period. */
  draft?: { submission: string; status: SubmissionStatus; updated: string };
}

export interface EntryRow {
  /** Stable key: area plus breakdown. */
  key: string;
  area: string;
  areaName: string;
  dims: Record<string, string>;
  /** Value per period: the draft's when it has one, else the published value. */
  values: Record<string, number | null>;
  published: Record<string, number | null>;
  /** The value for the period before the first column, for the first cell's corner. */
  before: number | null;
}

export interface EntrySheet {
  indicator: { code: string; name: string; unit: string; periodicity: Periodicity };
  org: string;
  orgName: string;
  /** Columns, oldest first; the last is the period being collected. */
  periods: string[];
  /** Grouped by breakdown: totals first, then each breakdown's rows. */
  rows: EntryRow[];
  draft?: { submission: string; status: SubmissionStatus; updated: string };
  /** Set when the submission for this period has moved past draft or returned: read-only. */
  locked?: SubmissionStatus;
}

export interface EntryCell {
  area: string;
  dims: Record<string, string>;
  period: string;
  value: number | null;
}

export interface EntrySaveResult {
  submission: string;
  saved: string;
}

// ---- Connectors (Phase 7d, brief §7) ----

export type ConnectorType = "sdmx" | "rest" | "sftp" | "csv";
export type ConnectorAuth = "none" | "token" | "basic";
export type ConnectorRunStatus = "ok" | "failed";

export interface ConnectorSummary {
  id: string;
  name: string;
  org: string;
  orgName: string;
  type: ConnectorType;
  /** Five-field cron expression, in the country's time zone. */
  schedule: string;
  enabled: boolean;
  lastRun?: { date: string; status: ConnectorRunStatus; rows: number; error?: string };
}

/** One source field and where its values go (the import wizard's fields). */
export interface ConnectorMapping {
  source: string;
  target: ImportField;
}

export interface ConnectorLogLine {
  time: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface ConnectorRun {
  id: string;
  started: string;
  finished: string;
  status: ConnectorRunStatus;
  trigger: "schedule" | "manual";
  by?: { id: string; name: string };
  rows: number;
  /** The submission the run created. */
  submission?: string;
  error?: string;
  log: ConnectorLogLine[];
}

export interface Connector extends ConnectorSummary {
  endpoint: string;
  auth: ConnectorAuth;
  /** Fields the source offered at the last successful test. */
  sourceFields: string[];
  mapping: ConnectorMapping[];
  /** Fields a source field can map to, as in the import wizard. */
  targets: ImportField[];
  /** Newest first. */
  runs: ConnectorRun[];
}

export interface ConnectorInput {
  name: string;
  org: string;
  type: ConnectorType;
  endpoint: string;
  auth: ConnectorAuth;
  schedule: string;
  enabled: boolean;
  mapping: ConnectorMapping[];
}

export interface ConnectorTestResult {
  ok: boolean;
  latencyMs: number;
  /** Fields found in the source's sample. */
  fields: string[];
  /** With `org` in the request: what each field can map to, and a suggested mapping. */
  targets?: ImportField[];
  suggested?: ConnectorMapping[];
  error?: "unreachable" | "auth" | "scheme";
  /** Technical detail from the source, shown as is. */
  detail?: string;
}

export interface ConnectorDryRun {
  total: number;
  /** The first 50 mapped rows. */
  rows: {
    indicator: string;
    area: string;
    period: string;
    dims: Record<string, string>;
    value: number | null;
    flag?: ObsStatus;
  }[];
  /** Rows that would fail a quality rule. */
  issues: number;
}

// ---- Quality (Phase 7d) ----

export interface QualityRate {
  /** Share of checked rows with no error and no unjustified warning; null when none were checked. */
  passRate: number | null;
  checked: number;
}

export interface QualityWarning {
  submission: string;
  status: SubmissionStatus;
  org: string;
  orgName: string;
  indicator: string;
  indicatorName: string;
  area: string;
  areaName: string;
  period: string;
  rule: QualityRule;
  value: number | null;
  updated: string;
}

export interface QualityOverview {
  passRate: number;
  /** The rate 30 days ago. */
  previous: number;
  checked: number;
  byOrg: (QualityRate & { org: string; name: string })[];
  byIndicator: (QualityRate & { code: string; name: string })[];
  /** Last six months by submission date (YYYY-MM), oldest first. */
  byMonth: (QualityRate & { month: string })[];
  /** Unjustified warnings in open submissions, newest first. */
  warnings: QualityWarning[];
}

// ---- Indicator referential (Phase 7d) ----

/** Text in every enabled locale, keyed by locale; the editor shows them side by side. */
export type Localised = Record<string, string>;

export interface PriorityScores {
  availability: number;
  quality: number;
  strategic: number;
  comparability: number;
}

export interface IndicatorRecord {
  code: string;
  status: IndicatorStatus;
  pillar: string;
  theme: string;
  /** Organisation code of the source. */
  org: string;
  name: Localised;
  shortDefinition: Localised;
  /** Markdown, may contain $$LaTeX$$. */
  definition: Localised;
  computation: Localised;
  qualityNotes: Localised;
  synonyms: string[];
  licence: string;
  unit: Localised;
  unitVariants: { code: string; label: Localised }[];
  higherIsBetter: boolean;
  isHeadline: boolean;
  disaggregations: string[];
  geoLevels: string[];
  /** Plausible bounds and the jump threshold; values outside raise a warning. */
  thresholds: { min: number | null; max: number | null; jumpPct: number };
  /** Normalisation bounds for the index, and the target. */
  goalposts: {
    min: number | null;
    max: number | null;
    target: number | null;
    targetYear: string | null;
  };
  intlRefs: { org: IntlRef["org"]; code: string; name: Localised; url: string }[];
  periodicity: Periodicity;
  /** YYYY-MM */
  nextRelease: string | null;
  /** 1–5 each. */
  priority: PriorityScores;
}

export interface IndicatorVersion {
  version: number;
  date: string;
  note: string;
  author: { id: string; name: string };
  /** Top-level fields that changed. */
  changes: (keyof IndicatorRecord)[];
}

export interface IndicatorAdmin extends IndicatorRecord {
  version: number;
  updated: string;
  /** Newest first. */
  versions: IndicatorVersion[];
}

export interface IndicatorAdminSummary {
  code: string;
  name: string;
  pillar: string;
  pillarName: string;
  status: IndicatorStatus;
  /** Mean of the four prioritisation scores. */
  priority: number;
  periodicity: Periodicity;
  org: string;
  orgName: string;
  version: number;
  updated: string;
}

export interface IndicatorCreateInput {
  code: string;
  name: Localised;
  pillar: string;
  theme: string;
  org: string;
}

// ---- Content: dashboards builder, publications, reports (Phase 7e) ----

/** draft: never published; published: live and unchanged; changed: live, with unpublished edits. */
export type ContentStatus = "draft" | "published" | "changed";

export interface AdminWidget extends Omit<Widget, "title" | "body"> {
  title: Localised;
  body?: Localised;
}

export interface DashboardRecord {
  title: Localised;
  description: Localised;
  audience: Dashboard["audience"];
  widgets: AdminWidget[];
}

export interface DashboardAdmin extends DashboardRecord {
  slug: string;
  status: ContentStatus;
  updated: string;
  publishedAt?: string;
}

export interface DashboardAdminSummary {
  slug: string;
  title: string;
  audience: Dashboard["audience"];
  widgetCount: number;
  status: ContentStatus;
  updated: string;
}

export interface DashboardCreateInput {
  slug: string;
  title: Localised;
  audience: Dashboard["audience"];
}

export type SignatureStatus = "pending" | "signed" | "failed";

export interface PublicationRecord {
  title: Localised;
  summary: Localised;
  type: Publication["type"];
  /** Reporting period covered, e.g. 2026-Q3 or 2025. */
  period: string;
  pillar?: string;
  /** Release date, YYYY-MM-DD. */
  date: string;
}

export interface PublicationAdmin extends PublicationRecord {
  slug: string;
  published: boolean;
  fileName: string;
  fileBytes: number;
  fileUrl: string;
  coverUrl: string;
  /** The backend signs each uploaded PDF; publishing waits for `signed`. */
  signature: SignatureStatus;
  signedAt?: string;
  updated: string;
}

export interface PublicationAdminSummary {
  slug: string;
  title: string;
  type: Publication["type"];
  period: string;
  date: string;
  published: boolean;
  signature: SignatureStatus;
  updated: string;
}

export type ReportTemplate = "quarterly" | "annual";

export interface ReportComment {
  id: string;
  author: { id: string; name: string };
  date: string;
  text: string;
  resolved: boolean;
}

export type ReportBlock =
  | {
      id: string;
      type: "text";
      /** Rich text as HTML from the editor. */
      html: string;
      assignee?: string;
      /** Read-only in PUT bodies: comments have their own endpoints. */
      comments: ReportComment[];
    }
  | { id: string; type: "kpis"; indicators: string[] }
  | { id: string; type: "chart"; indicator: string; area?: string; years?: string }
  | { id: string; type: "map"; indicator: string; year?: string }
  | { id: string; type: "table"; indicators: string[]; years?: string };

export interface ReportAdmin {
  id: string;
  title: string;
  template: ReportTemplate;
  period: string;
  blocks: ReportBlock[];
  createdBy: { id: string; name: string };
  updated: string;
  /** People a text block can be assigned to. */
  people: { id: string; name: string }[];
}

export interface ReportSummary {
  id: string;
  title: string;
  template: ReportTemplate;
  period: string;
  blockCount: number;
  openComments: number;
  updated: string;
}

// ---- Editorial: news, watch queue, CMS pages, home modules (Phase 7f) ----

/** An uploaded picture (`POST /admin/media`); `url` is public and goes into the content. */
export interface MediaUpload {
  url: string;
  name: string;
  bytes: number;
}

export type NewsStatus = "draft" | "scheduled" | "published";

export interface NewsRecord {
  title: Localised;
  excerpt: Localised;
  /** Rich text as HTML from the editor. */
  body: Localised;
  tags: string[];
  /** Date shown on the portal, YYYY-MM-DD. */
  date: string;
  /** Watch items link to where the story came from. */
  sourceUrl?: string;
  imageUrl?: string;
}

export interface NewsAdmin extends NewsRecord {
  slug: string;
  kind: NewsItem["kind"];
  status: NewsStatus;
  /** When a scheduled article goes live (ISO date-time). */
  publishAt?: string;
  updated: string;
}

export interface NewsAdminSummary {
  slug: string;
  title: string;
  kind: NewsItem["kind"];
  status: NewsStatus;
  date: string;
  tags: string[];
  publishAt?: string;
  updated: string;
}

export interface NewsCreateInput extends NewsRecord {
  slug: string;
}

export type WatchStatus = "pending" | "approved" | "rejected";

/** A story the collector found (brief §7 *Watch queue*). */
export interface WatchItem {
  id: string;
  title: string;
  excerpt: string;
  /** Language of the story, as found. */
  lang: string;
  source: string;
  sourceUrl: string;
  /** Keywords that matched. */
  keywords: string[];
  found: string;
  status: WatchStatus;
  /** The news item made from it, once approved or opened for editing. */
  article?: string;
}

export interface WatchSource {
  name: string;
  url: string;
  enabled: boolean;
}

export interface WatchSettings {
  keywords: string[];
  sources: WatchSource[];
}

export interface WatchQueue {
  items: WatchItem[];
  counts: Record<WatchStatus, number>;
  settings: WatchSettings;
}

/** A CMS block with its text in every language. Rich text and callouts are Markdown. */
export interface PageBlock {
  type: CmsBlock["type"];
  body?: Localised;
  src?: string;
  alt?: Localised;
  /** The first row is the header. */
  rows?: Localised[][];
  partners?: { name: Localised; url?: string; logo?: string }[];
}

export interface PageRecord {
  title: Localised;
  blocks: PageBlock[];
}

export interface PageAdmin extends PageRecord {
  slug: string;
  status: ContentStatus;
  updated: string;
}

export interface PageAdminSummary {
  slug: string;
  title: string;
  blockCount: number;
  status: ContentStatus;
  updated: string;
}

/** The home page modules an editor sets (brief §7 *Pages*). */
export interface HomeModules {
  exampleChips: { label: Localised; href: string }[];
  featuredIndicators: string[];
  mapTeaserIndicator: string;
  benchmarkIndicator: string;
}

export interface HomeModulesAdmin extends HomeModules {
  status: ContentStatus;
  updated: string;
}

// ---- Alerts and newsletter (Phase 7f) ----

export type AlertCondition = "threshold" | "change" | "off_track" | "overdue" | "anomaly";
export type AlertChannel = "email" | "sms" | "in_app";

export interface AlertRuleInput {
  name: string;
  indicator: string;
  condition: AlertCondition;
  /** `threshold` only: fire when the value is above or below `value`. */
  operator?: "above" | "below";
  /** `threshold`: in the indicator's unit. `change`: percent against the previous period. */
  value?: number;
  /** Back-office user ids. */
  recipients: string[];
  channels: AlertChannel[];
  enabled: boolean;
}

export interface AlertRule extends AlertRuleInput {
  id: string;
  indicatorName: string;
  lastTriggered?: string;
  updated: string;
}

export interface AlertRules {
  rules: AlertRule[];
  /** People a rule can notify. */
  people: { id: string; name: string }[];
}

export interface AlertEvent {
  id: string;
  rule: string;
  ruleName: string;
  indicator: string;
  indicatorName: string;
  condition: AlertCondition;
  date: string;
  /** What set it off, where the condition has a value. */
  value?: number;
  unit?: string;
  period?: string;
  channels: AlertChannel[];
  recipients: number;
  status: "sent" | "failed";
}

export type CampaignStatus = "draft" | "scheduled" | "sent";

export interface CampaignItem {
  kind: "news" | "publication";
  slug: string;
}

/** Empty lists mean everyone. */
export interface CampaignAudience {
  locales: string[];
  topics: string[];
}

export interface CampaignInput {
  subject: Localised;
  intro: Localised;
  items: CampaignItem[];
  audience: CampaignAudience;
}

export interface Campaign extends CampaignInput {
  id: string;
  status: CampaignStatus;
  sendAt?: string;
  sentAt?: string;
  /** Subscribers the audience matches now, or who received it once sent. */
  recipients: number;
  opens: number;
  clicks: number;
  updated: string;
}

export interface CampaignSummary {
  id: string;
  subject: string;
  status: CampaignStatus;
  sendAt?: string;
  sentAt?: string;
  recipients: number;
  /** 0–1; null until it's sent. */
  openRate: number | null;
  clickRate: number | null;
  updated: string;
}

/** A published item a newsletter can include. */
export interface CampaignChoice extends CampaignItem {
  title: string;
  date: string;
}

export interface CampaignOptions {
  choices: CampaignChoice[];
  /** Topics subscribers can follow (the pillars). */
  topics: { code: string; name: string }[];
}

export interface CampaignPreview {
  subject: string;
  /** The email as the backend would send it. */
  html: string;
  recipients: number;
}

export interface Subscriber {
  email: string;
  locale: Locale;
  topics: string[];
  status: "active" | "unsubscribed";
  since: string;
}

// ---------------------------------------------------------------------------------------------
// Phase 7g: users, organisations, feedback inbox, audit log and settings (brief §7).

/** `invited` until the person first signs in. */
export type UserStatus = "active" | "invited" | "deactivated";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  roles: AdminRole[];
  orgs: { code: string; name: string }[];
  mfa: boolean;
  status: UserStatus;
  /** Absent until the first sign-in. */
  lastLogin?: string;
  invitedAt?: string;
}

/** `POST /admin/users`: the invitation (brief §7 "Invite (email, org, role)"). */
export interface UserInviteInput {
  name: string;
  email: string;
  role: AdminRole;
  orgs: string[];
}
/** `PUT /admin/users/:id`: the email is the sign-in identity and doesn't change. */
export type UserUpdateInput = Omit<UserInviteInput, "email">;

/** `GET /admin/users`: a page of users, counts per status for the same search, and the
 * organisations a user can be given. */
export interface UserPage extends Page<AdminUser> {
  counts: Record<UserStatus, number>;
  orgs: { code: string; name: string }[];
}

export interface OrgContact {
  name: string;
  role: string;
  email: string;
  phone?: string;
}

export interface OrganisationAdminSummary extends Organisation {
  indicators: number;
  connectors: number;
  users: number;
  contact?: string;
}

/** What `PUT /admin/organisations/:code` saves. */
export interface OrganisationRecord {
  name: Localised;
  kind: Organisation["kind"];
  description: Localised;
  website?: string;
  contacts: OrgContact[];
}

export interface OrganisationAdmin extends OrganisationRecord {
  code: string;
  updated: string;
  /** Indicators whose source is this organisation; changed in the indicator referential. */
  indicators: { code: string; name: string; status: IndicatorStatus }[];
  connectors: { id: string; name: string; lastStatus: ConnectorRunStatus; lastRun: string }[];
  users: { id: string; name: string; roles: AdminRole[]; status: UserStatus }[];
}

/** One message in the inbox: the public item plus what only the back office sees. */
export interface FeedbackAdminItem extends FeedbackItem {
  email?: string;
  /** Internal note, never shown to the sender. */
  note?: string;
  updated?: string;
}

export interface FeedbackPage extends Page<FeedbackAdminItem> {
  counts: Record<FeedbackItem["status"], number>;
}

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "unpublish"
  | "transition"
  | "invite"
  | "deactivate"
  | "reactivate"
  | "send"
  | "run";

export type AuditEntity =
  | "submission"
  | "import"
  | "connector"
  | "indicator"
  | "dashboard"
  | "publication"
  | "report"
  | "news"
  | "page"
  | "alert"
  | "newsletter"
  | "user"
  | "organisation"
  | "feedback"
  | "settings";

/** One link of the audit chain: `hash` covers this entry and `prevHash`. */
export interface AuditEntry {
  seq: number;
  date: string;
  actor: { id: string; name: string };
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** The record before and after, when the action changed one. */
  before?: unknown;
  after?: unknown;
  prevHash: string;
  hash: string;
}

export interface AuditPage extends Page<AuditEntry> {
  /** Everyone who appears in the log, for the actor filter. */
  actors: { id: string; name: string }[];
}

/** `POST /admin/audit/verify`: the whole chain recomputed. */
export interface AuditVerification {
  ok: boolean;
  checked: number;
  /** The first entry whose hash doesn't match. */
  brokenAt?: number;
  verifiedAt: string;
}

export type RuntimeSettingKey =
  "contactEmail" | "exportMaxRows" | "sessionMinutes" | "cacheSeconds";
export type FeatureKey = "newsWatch" | "smsSignup" | "chatbot" | "basemap";
export type QuotaTier = "anonymous" | "registered" | "partner";

export interface ApiQuota {
  tier: QuotaTier;
  perMinute: number;
  perDay: number;
}

/** What `PUT /admin/settings` saves. */
export interface SettingsInput {
  /** `null` goes back to the deployment's default. */
  overrides: Record<RuntimeSettingKey, string | null>;
  features: Record<FeatureKey, boolean>;
  quotas: ApiQuota[];
}

export interface ChannelTest {
  ok: boolean;
  date: string;
  /** The gateway's own words when it failed. */
  detail?: string;
}

export interface SettingsAdmin extends SettingsInput {
  defaults: Record<RuntimeSettingKey, string>;
  featureDefaults: Record<FeatureKey, boolean>;
  smtp: { host: string; from: string; lastTest?: ChannelTest };
  sms: { provider: string; sender: string; lastTest?: ChannelTest };
  updated?: string;
  updatedBy?: string;
}
