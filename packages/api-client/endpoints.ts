import { apiFetch, apiFetchRaw, type ApiFetchOptions, type QueryValue } from "./client";
import type {
  ApiKeyInput,
  Area,
  Benchmark,
  CmsPage,
  Dashboard,
  Dataset,
  ExportJob,
  ExportRequest,
  FeedbackInput,
  HomeData,
  IndexScore,
  Indicator,
  IndicatorSummary,
  NewsItem,
  Observation,
  Page,
  Pillar,
  Publication,
  Series,
  Strategy,
  SubscriberInput,
} from "./types";

const REVALIDATE_SECONDS = 300;
const POLL_INTERVAL_MS = 1_500;
const POLL_LIMIT_MS = 60_000;

export type RequestContext = Pick<ApiFetchOptions, "locale" | "signal" | "next">;

export interface IndicatorQuery extends Record<string, QueryValue> {
  q?: string;
  pillar?: string;
  theme?: string;
  geo_level?: string;
  headline?: boolean;
  source?: string;
  periodicity?: string;
  status?: string;
  subnational?: boolean;
  area?: string;
  page?: number;
  pageSize?: number;
}
export interface DataQuery extends Record<string, QueryValue> {
  indicator: string;
  area?: string;
  level?: string;
  year?: string;
  dims?: string;
  unit?: string;
  page?: number;
  pageSize?: number;
}
export interface SeriesQuery extends Record<string, QueryValue> {
  indicator: string;
  area: string;
  years?: string;
  dims?: string;
  unit?: string;
}

/** Cache settings for Server Components, so a publish can call `revalidateTag`. */
export function serverCache(...tags: string[]): ApiFetchOptions["next"] {
  return { revalidate: REVALIDATE_SECONDS, tags };
}

const get = <T>(path: string, ctx: RequestContext, query?: Record<string, QueryValue>) =>
  apiFetch<T>(path, { ...ctx, query });
const post = <T>(path: string, ctx: RequestContext, body: unknown) =>
  apiFetch<T>(path, { ...ctx, method: "POST", body });
const code = encodeURIComponent;

export const api = {
  pillars: (ctx: RequestContext) => get<Pillar[]>("/pillars", ctx),
  indicators: (ctx: RequestContext, query: IndicatorQuery = {}) =>
    get<Page<IndicatorSummary>>("/indicators", ctx, query),
  indicator: (ctx: RequestContext, indicator: string) =>
    get<Indicator>(`/indicators/${code(indicator)}`, ctx),
  areas: (ctx: RequestContext, query: { level?: string; parent?: string; q?: string } = {}) =>
    get<Area[]>("/areas", ctx, query),
  geometry: (ctx: RequestContext, area: string, level: string) =>
    get<unknown>(`/areas/${code(area)}/geometry`, ctx, { level }),
  series: (ctx: RequestContext, query: SeriesQuery) => get<Series[]>("/series", ctx, query),
  data: (ctx: RequestContext, query: DataQuery) => get<Page<Observation>>("/data", ctx, query),
  dataDownload: (ctx: RequestContext, query: DataQuery & { format: string }) =>
    apiFetchRaw("/data", { ...ctx, query }),
  latest: (
    ctx: RequestContext,
    query: { indicator: string; area?: string; level?: string; unit?: string },
  ) => get<Observation[]>("/data/latest", ctx, query),
  benchmark: (ctx: RequestContext, query: { indicator: string; group: string; year?: string }) =>
    get<Benchmark>("/benchmark", ctx, query),
  index: (ctx: RequestContext, year?: string) => get<IndexScore>("/index", ctx, { year }),
  targets: (ctx: RequestContext) => get<Strategy>("/targets", ctx),
  dashboards: (ctx: RequestContext) => get<Dashboard[]>("/dashboards", ctx),
  dashboard: (ctx: RequestContext, slug: string) =>
    get<Dashboard>(`/dashboards/${code(slug)}`, ctx),
  publications: (
    ctx: RequestContext,
    query: {
      type?: string;
      year?: string;
      pillar?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) => get<Page<Publication>>("/publications", ctx, query),
  publication: (ctx: RequestContext, slug: string) =>
    get<Publication>(`/publications/${code(slug)}`, ctx),
  news: (
    ctx: RequestContext,
    query: { kind?: string; tag?: string; q?: string; page?: number } = {},
  ) => get<Page<NewsItem>>("/news", ctx, query),
  newsItem: (ctx: RequestContext, slug: string) => get<NewsItem>(`/news/${code(slug)}`, ctx),
  home: (ctx: RequestContext) => get<HomeData>("/home", ctx),
  page: (ctx: RequestContext, slug: string) => get<CmsPage>(`/pages/${code(slug)}`, ctx),
  datasets: (ctx: RequestContext) => get<Dataset[]>("/datasets", ctx),
  feedback: (ctx: RequestContext, input: FeedbackInput) =>
    post<{ ok: true }>("/feedback", ctx, input),
  subscribe: (ctx: RequestContext, input: SubscriberInput) =>
    post<{ ok: true }>("/subscribers", ctx, input),
  requestApiKey: (ctx: RequestContext, input: ApiKeyInput) =>
    post<{ ok: true }>("/api-keys", ctx, input),
  createExport: (ctx: RequestContext, input: ExportRequest) =>
    post<{ jobId: string }>("/exports", ctx, input),
  exportJob: (ctx: RequestContext, jobId: string) => get<ExportJob>(`/exports/${code(jobId)}`, ctx),
};

export class ExportTimeoutError extends Error {
  constructor() {
    super("Export polling timed out");
    this.name = "ExportTimeoutError";
  }
}

/** Polls every 1.5 s. Throws `ExportTimeoutError` after `limitMs` so the UI can say so and resume. */
export async function pollExport(
  ctx: RequestContext,
  jobId: string,
  limitMs = POLL_LIMIT_MS,
): Promise<ExportJob> {
  const deadline = Date.now() + limitMs;
  for (;;) {
    const job = await api.exportJob(ctx, jobId);
    if (job.status === "done" || job.status === "failed") return job;
    if (Date.now() + POLL_INTERVAL_MS > deadline) throw new ExportTimeoutError();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
