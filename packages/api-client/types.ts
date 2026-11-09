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
