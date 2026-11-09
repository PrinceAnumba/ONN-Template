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

export type ExportFormat = "pdf" | "pptx" | "xlsx";
export interface ExportRequest {
  format: ExportFormat;
  resource: string;
  params?: Record<string, string>;
}
export type ExportStatus = "queued" | "running" | "done" | "failed";
export interface ExportJob {
  status: ExportStatus;
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
