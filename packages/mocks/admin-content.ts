// Back-office mock for Phase 7e (brief §7): the dashboards builder, publications and reports.
// Publishing a dashboard or a publication writes the public fixture in place and refreshes the
// portal, like publishing values does. Reports stay private; their PDF/DOCX export is a job.
import { can } from "@onn/api-client/permissions";
import type {
  AdminWidget,
  ContentStatus,
  DashboardAdmin,
  DashboardAdminSummary,
  DashboardRecord,
  ExportJob,
  PublicationAdmin,
  PublicationAdminSummary,
  PublicationRecord,
  ReportAdmin,
  ReportBlock,
  ReportComment,
  ReportSummary,
  ReportTemplate,
  Widget,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type { AdminState, StoredUser } from "./admin-seed";
import type { RouteContext } from "./admin";
import type { Fixtures } from "./fixtures";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Text = Record<string, string>;
type FieldError = { path: string; message: string };

export interface StoredDashboard extends DashboardRecord {
  slug: string;
  status: ContentStatus;
  updated: string;
  publishedAt?: string;
  /** What the portal shows, so "changed" can be worked out. */
  live?: DashboardRecord;
}

export interface StoredFile {
  name: string;
  type: string;
  data: Uint8Array;
}

export interface StoredPublication extends PublicationRecord {
  slug: string;
  published: boolean;
  file: StoredFile;
  cover?: StoredFile;
  signature: PublicationAdmin["signature"];
  signedAt?: string;
  /** When the simulated signing service answers. */
  signsAt: number;
  updated: string;
}

export interface StoredReport {
  id: string;
  title: string;
  template: ReportTemplate;
  period: string;
  blocks: ReportBlock[];
  createdBy: string;
  updated: string;
}

export interface ContentState {
  dashboards: StoredDashboard[];
  publications: StoredPublication[];
  reports: StoredReport[];
  exports: Map<string, { polls: number; format: string; report: string }>;
}

export interface ContentDeps {
  authed: (
    method: Method,
    path: string,
    resolver: (ctx: RouteContext & { user: StoredUser }) => Response | Promise<Response>,
  ) => RequestHandler;
  problem: (status: number, title: string, detail?: string) => Response;
  state: AdminState;
  locales: string[];
  defaultLocale: string;
  /** Codes the widgets and blocks may use (the public catalogue). */
  indicatorCodes: () => string[];
  areaCodes: string[];
  peerGroups: string[];
  pillars: string[];
  /** The public stores the portal reads (fixtures, edited in place). */
  publicDashboards: Fixtures["dashboards"];
  publicPublications: Fixtures["publications"];
  /** Tells the portal to fetch again (the backend's publish webhook). */
  revalidate: (tags: string[]) => void;
}

const DAY = 24 * 60 * 60 * 1000;
/** How long the simulated signing service takes. */
export const SIGNING_MS = 4000;
const POLLS_UNTIL_DONE = 4;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_COVER_BYTES = 2 * 1024 * 1024;
const COVER_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YEARS = /^\d{4}(?:-\d{4})?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WIDGET_TYPES: Widget["type"][] = [
  "kpi",
  "line",
  "bar",
  "stacked",
  "donut",
  "radar",
  "treemap",
  "map",
  "table",
  "target",
  "text",
];
const AUDIENCES = ["decision", "analyst", "public"] as const;
const PUBLICATION_TYPES = ["quarterly", "annual", "study", "method"] as const;
const BLOCK_TYPES: ReportBlock["type"][] = ["text", "kpis", "chart", "map", "table"];
/** Types that plot several indicators; the others use the first. */
const MULTI: Partial<Record<Widget["type"], number>> = { line: 4, radar: 1, table: 4 };
const PERIOD: Record<string, RegExp> = {
  quarterly: /^\d{4}-Q[1-4]$/,
  annual: /^\d{4}$/,
};
/** Seeded report text, in the default language (stored content, not UI strings). */
const SEED_TEXT: Record<
  string,
  Record<"title" | "comment" | "summary" | "summaryBody" | "analysis" | "outlook", string>
> = {
  fr: {
    title: "Rapport trimestriel",
    comment: "Ajouter une phrase sur la couverture 4G en zone rurale.",
    summary: "Synthèse",
    summaryBody: "Les principales évolutions du trimestre.",
    analysis: "Analyse",
    outlook: "Perspectives",
  },
  en: {
    title: "Quarterly report",
    comment: "Add a sentence on 4G coverage in rural regions.",
    summary: "Summary",
    summaryBody: "Key changes this quarter.",
    analysis: "Analysis",
    outlook: "Outlook",
  },
};
export const MINIMAL_PDF = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");

const invalid = (errors: FieldError[]) =>
  HttpResponse.json(
    { type: "validation", title: "Invalid", status: 422, errors },
    { status: 422, headers: { "Content-Type": "application/problem+json" } },
  );
const typed = (status: number, type: string, title: string) =>
  HttpResponse.json(
    { type, title, status },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
const clone = <T>(value: T): T => structuredClone(value);
const isText = (value: unknown): value is Text =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.values(value as object).every((item) => typeof item === "string");
const cleanText = (value: unknown, locales: string[]): Text =>
  isText(value)
    ? Object.fromEntries(
        locales.filter((locale) => value[locale]?.trim()).map((locale) => [locale, value[locale]!]),
      )
    : {};

/** Content seeded from the fixtures: every dashboard and publication published, one report. */
export function seedContent(data: Fixtures, users: StoredUser[], now: Date): ContentState {
  const at = now.toISOString();
  const dashboards: StoredDashboard[] = data.dashboards.map((item) => {
    const record: DashboardRecord = {
      title: { ...(item.title as unknown as Text) },
      description: { ...(item.description as unknown as Text) },
      audience: item.audience as DashboardRecord["audience"],
      widgets: (item.widgets as unknown as AdminWidget[]).map((widget) => clone(widget)),
    };
    return {
      slug: item.slug as string,
      ...clone(record),
      status: "published",
      updated: at,
      publishedAt: at,
      live: record,
    };
  });

  const publications: StoredPublication[] = data.publications.map((item) => {
    const year = String(item.date).slice(0, 4);
    const type = item.type as PublicationRecord["type"];
    return {
      slug: item.slug as string,
      title: { ...(item.title as unknown as Text) },
      summary: { ...(item.summary as unknown as Text) },
      type,
      period: type === "quarterly" ? `${year}-Q1` : year,
      pillar: item.pillar as string | undefined,
      date: item.date as string,
      published: true,
      file: { name: `${item.slug}.pdf`, type: "application/pdf", data: MINIMAL_PDF },
      signature: item.verified ? "signed" : "failed",
      signedAt: item.verified ? `${item.date}T10:00:00.000Z` : undefined,
      signsAt: 0,
      updated: `${item.date}T09:00:00.000Z`,
    };
  });

  const headline = data.indicators.filter((item) => item.isHeadline).map((item) => item.code);
  const editor = users.find((user) => user.roles.includes("editor")) ?? users[0]!;
  const admin = users.find((user) => user.roles.includes("admin")) ?? users[0]!;
  const quarter = Math.floor(now.getUTCMonth() / 3) || 4;
  const year =
    quarter === 4 && now.getUTCMonth() < 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
  const words = SEED_TEXT[data.meta.defaultLocale] ?? SEED_TEXT.en!;
  const blocks = templateBlocks(
    "quarterly",
    headline as string[],
    data.meta.iso3,
    data.meta.defaultLocale,
  );
  const intro = blocks[0] as Extract<ReportBlock, { type: "text" }>;
  intro.assignee = editor.id;
  intro.comments = [
    {
      id: "c1",
      author: { id: admin.id, name: admin.name },
      date: new Date(now.getTime() - 2 * DAY).toISOString(),
      text: words.comment,
      resolved: false,
    },
  ];
  return {
    dashboards,
    publications,
    reports: [
      {
        id: "REP-1",
        title: `${words.title} ${year}-Q${quarter}`,
        template: "quarterly",
        period: `${year}-Q${quarter}`,
        blocks,
        createdBy: editor.id,
        updated: new Date(now.getTime() - DAY).toISOString(),
      },
    ],
    exports: new Map(),
  };
}

/** Starting blocks for a template (brief §7 report builder). */
export function templateBlocks(
  template: ReportTemplate,
  headline: string[],
  iso3: string,
  locale: string,
): ReportBlock[] {
  const words = SEED_TEXT[locale] ?? SEED_TEXT.en!;
  let n = 0;
  const id = () => `b${++n}`;
  const text = (html: string): ReportBlock => ({ id: id(), type: "text", html, comments: [] });
  const first = headline[0] ?? "";
  const quarterly: ReportBlock[] = [
    text(`<h2>${words.summary}</h2><p>${words.summaryBody}</p>`),
    { id: id(), type: "kpis", indicators: headline.slice(0, 4) },
    { id: id(), type: "chart", indicator: first, area: iso3 },
    text(`<h2>${words.analysis}</h2><p></p>`),
    { id: id(), type: "map", indicator: first },
  ];
  if (template === "quarterly") return quarterly;
  return [
    ...quarterly,
    { id: id(), type: "table", indicators: headline.slice(0, 4) },
    text(`<h2>${words.outlook}</h2><p></p>`),
  ];
}

export function createContentHandlers(deps: ContentDeps) {
  const { authed, problem, state, locales, defaultLocale } = deps;
  const content = state.content;
  const pick = (value: Text | undefined, locale: string) =>
    value?.[locale] || value?.[defaultLocale] || Object.values(value ?? {})[0] || "";
  const forbidden = () => typed(403, "role", "Your role can't edit content");
  const guard = (user: StoredUser) => can(user.roles, "content.edit");
  const userName = (id: string) => state.users.find((user) => user.id === id)?.name ?? id;
  const now = () => new Date().toISOString();

  // ---- Dashboards ----
  const dashboardAdmin = (item: StoredDashboard): DashboardAdmin => {
    const rest: StoredDashboard = clone(item);
    delete rest.live;
    return rest;
  };
  const record = (item: DashboardRecord): DashboardRecord => ({
    title: item.title,
    description: item.description,
    audience: item.audience,
    widgets: item.widgets,
  });

  const widgetErrors = (widgets: unknown): { widgets: AdminWidget[]; errors: FieldError[] } => {
    const errors: FieldError[] = [];
    if (!Array.isArray(widgets))
      return { widgets: [], errors: [{ path: "widgets", message: "required" }] };
    const codes = new Set(deps.indicatorCodes());
    const ids = new Set<string>();
    const clean = widgets.map((raw, index): AdminWidget => {
      const widget = (raw ?? {}) as Partial<AdminWidget>;
      const at = (field: string, message: string) =>
        errors.push({ path: `widgets.${index}.${field}`, message });
      const id = String(widget.id ?? "");
      if (!id || ids.has(id)) at("id", id ? "duplicate" : "required");
      ids.add(id);
      const type = WIDGET_TYPES.includes(widget.type as Widget["type"])
        ? (widget.type as Widget["type"])
        : "kpi";
      if (type !== widget.type) at("type", "unknown");
      const title = cleanText(widget.title, locales);
      if (!title[defaultLocale]) at(`title.${defaultLocale}`, "required");
      const indicators = Array.isArray(widget.indicators) ? widget.indicators.map(String) : [];
      if (type === "text") {
        if (!cleanText(widget.body, locales)[defaultLocale])
          at(`body.${defaultLocale}`, "required");
      } else if (indicators.length === 0) at("indicators", "required");
      else if (indicators.length > (MULTI[type] ?? 1)) at("indicators", "count");
      else if (indicators.some((code) => !codes.has(code))) at("indicators", "unknown");
      const span = [1, 2, 3].includes(Number(widget.span)) ? (Number(widget.span) as 1 | 2 | 3) : 1;
      if (span !== widget.span) at("span", "range");
      if (widget.years && !YEARS.test(widget.years)) at("years", "format");
      else if (widget.years?.includes("-")) {
        const [from, to] = widget.years.split("-").map(Number);
        if (from! > to!) at("years", "order");
      }
      if (widget.area && !deps.areaCodes.includes(widget.area)) at("area", "unknown");
      if (
        widget.compare &&
        !deps.areaCodes.includes(widget.compare) &&
        !deps.peerGroups.includes(widget.compare.replace(/^peer:/, ""))
      )
        at("compare", "unknown");
      const out: AdminWidget = {
        id,
        type,
        title,
        indicators: type === "text" ? [] : indicators,
        span,
      };
      if (type === "text") out.body = cleanText(widget.body, locales);
      if (widget.area) out.area = widget.area;
      if (widget.compare) out.compare = widget.compare;
      if (widget.years) out.years = widget.years;
      if (widget.dims && Object.keys(widget.dims).length) out.dims = { ...widget.dims };
      return out;
    });
    return { widgets: clean, errors };
  };

  const dashboardErrors = (input: Partial<DashboardRecord>) => {
    const errors: FieldError[] = [];
    const title = cleanText(input.title, locales);
    if (!title[defaultLocale]) errors.push({ path: `title.${defaultLocale}`, message: "required" });
    const audience = AUDIENCES.includes(input.audience as (typeof AUDIENCES)[number])
      ? (input.audience as DashboardRecord["audience"])
      : "public";
    if (audience !== input.audience) errors.push({ path: "audience", message: "unknown" });
    const widgets = widgetErrors(input.widgets);
    return {
      errors: [...errors, ...widgets.errors],
      value: {
        title,
        description: cleanText(input.description, locales),
        audience,
        widgets: widgets.widgets,
      } satisfies DashboardRecord,
    };
  };

  const writePublicDashboard = (item: StoredDashboard) => {
    // A description left blank is stored as `{}`, which the public localiser can't resolve and
    // which reached React as an object (the portal page failed with a 500). Publish it as "".
    const description = Object.keys(item.description ?? {}).length ? item.description : "";
    const entry = {
      slug: item.slug,
      title: item.title,
      description,
      audience: item.audience,
      widgets: item.widgets,
    } as unknown as Fixtures["dashboards"][number];
    const index = deps.publicDashboards.findIndex((dashboard) => dashboard.slug === item.slug);
    if (index >= 0) deps.publicDashboards[index] = entry;
    else deps.publicDashboards.push(entry);
  };
  const dashboardTags = (slug: string) => ["dashboards", `dashboard:${slug}`, "home"];
  const findDashboard = (slug: string) => content.dashboards.find((item) => item.slug === slug);

  // ---- Publications ----
  const settle = (item: StoredPublication) => {
    if (item.signature !== "pending" || Date.now() < item.signsAt) return item;
    const pdf = new TextDecoder().decode(item.file.data.slice(0, 5)) === "%PDF-";
    item.signature = pdf ? "signed" : "failed";
    if (pdf) item.signedAt = new Date(item.signsAt).toISOString();
    return item;
  };
  const publicationAdmin = (item: StoredPublication): PublicationAdmin => {
    settle(item);
    return {
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      type: item.type,
      period: item.period,
      pillar: item.pillar,
      date: item.date,
      published: item.published,
      fileName: item.file.name,
      fileBytes: item.file.data.byteLength,
      fileUrl: `/admin/publications/${item.slug}/file`,
      coverUrl: `/admin/publications/${item.slug}/cover`,
      signature: item.signature,
      signedAt: item.signedAt,
      updated: item.updated,
    };
  };
  const publicationErrors = (input: Partial<PublicationRecord>, prefix = "") => {
    const errors: FieldError[] = [];
    const at = (path: string, message: string) => errors.push({ path: prefix + path, message });
    const title = cleanText(input.title, locales);
    if (!title[defaultLocale]) at(`title.${defaultLocale}`, "required");
    const summary = cleanText(input.summary, locales);
    if (!summary[defaultLocale]) at(`summary.${defaultLocale}`, "required");
    const type = PUBLICATION_TYPES.includes(input.type as PublicationRecord["type"])
      ? (input.type as PublicationRecord["type"])
      : "study";
    if (type !== input.type) at("type", "unknown");
    const period = String(input.period ?? "").trim();
    if (!period) at("period", "required");
    else if (PERIOD[type] && !PERIOD[type]!.test(period)) at("period", "format");
    const date = String(input.date ?? "");
    if (!DATE.test(date) || Number.isNaN(Date.parse(date)))
      at("date", date ? "format" : "required");
    if (input.pillar && !deps.pillars.includes(input.pillar)) at("pillar", "unknown");
    return {
      errors,
      value: {
        title,
        summary,
        type,
        period,
        date,
        ...(input.pillar ? { pillar: input.pillar } : {}),
      } satisfies PublicationRecord,
    };
  };
  const readFile = async (entry: FormDataEntryValue | null): Promise<StoredFile | null> =>
    entry && typeof entry !== "string"
      ? { name: entry.name, type: entry.type, data: new Uint8Array(await entry.arrayBuffer()) }
      : null;
  const pdfError = (file: StoredFile | null) =>
    !file
      ? "required"
      : !file.name.toLowerCase().endsWith(".pdf")
        ? "type"
        : file.data.byteLength > MAX_PDF_BYTES
          ? "size"
          : file.data.byteLength === 0
            ? "empty"
            : null;
  const coverError = (file: StoredFile | null) => {
    if (!file) return null;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!COVER_TYPES[ext]) return "type";
    return file.data.byteLength > MAX_COVER_BYTES ? "size" : null;
  };
  const writePublicPublication = (item: StoredPublication) => {
    const entry = {
      slug: item.slug,
      type: item.type,
      title: item.title,
      summary: item.summary,
      date: item.date,
      pillar: item.pillar,
      coverUrl: `/api/v1/publications/${item.slug}/cover.svg`,
      fileUrl: `/api/v1/publications/${item.slug}/file.pdf`,
      fileBytes: item.file.data.byteLength,
      verified: item.signature === "signed",
    } as unknown as Fixtures["publications"][number];
    const index = deps.publicPublications.findIndex(
      (publication) => publication.slug === item.slug,
    );
    if (index >= 0) deps.publicPublications[index] = entry;
    else deps.publicPublications.push(entry);
  };
  const publicationTags = (slug: string) => ["publications", `publication:${slug}`, "home"];
  const findPublication = (slug: string) => content.publications.find((item) => item.slug === slug);
  const fileResponse = (file: StoredFile, inline = true) =>
    new HttpResponse(file.data.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.name.replace(/"/g, "")}"`,
      },
    });

  // ---- Reports ----
  const people = () =>
    state.users
      .filter((user) => user.active && can(user.roles, "content.edit"))
      .map((user) => ({ id: user.id, name: user.name }));
  const reportAdmin = (item: StoredReport): ReportAdmin => ({
    id: item.id,
    title: item.title,
    template: item.template,
    period: item.period,
    blocks: clone(item.blocks),
    createdBy: { id: item.createdBy, name: userName(item.createdBy) },
    updated: item.updated,
    people: people(),
  });
  const reportSummary = (item: StoredReport): ReportSummary => ({
    id: item.id,
    title: item.title,
    template: item.template,
    period: item.period,
    blockCount: item.blocks.length,
    openComments: item.blocks.reduce(
      (sum, block) =>
        sum +
        (block.type === "text" ? block.comments.filter((comment) => !comment.resolved).length : 0),
      0,
    ),
    updated: item.updated,
  });
  const blockErrors = (blocks: unknown, stored: ReportBlock[]) => {
    const errors: FieldError[] = [];
    if (!Array.isArray(blocks))
      return { errors: [{ path: "blocks", message: "required" }], value: [] };
    const codes = new Set(deps.indicatorCodes());
    const assignees = new Set(people().map((person) => person.id));
    const ids = new Set<string>();
    const value = blocks.map((raw, index): ReportBlock => {
      const block = (raw ?? {}) as Record<string, unknown>;
      const at = (field: string, message: string) =>
        errors.push({ path: `blocks.${index}.${field}`, message });
      const id = String(block.id ?? "");
      if (!id || ids.has(id)) at("id", id ? "duplicate" : "required");
      ids.add(id);
      const type = BLOCK_TYPES.includes(block.type as ReportBlock["type"])
        ? (block.type as ReportBlock["type"])
        : "text";
      if (type !== block.type) at("type", "unknown");
      const indicator = String(block.indicator ?? "");
      const list = Array.isArray(block.indicators) ? block.indicators.map(String) : [];
      const years = block.years ? String(block.years) : undefined;
      if (years && !YEARS.test(years)) at("years", "format");
      const checkOne = () => {
        if (!indicator) at("indicator", "required");
        else if (!codes.has(indicator)) at("indicator", "unknown");
      };
      const checkList = (max: number) => {
        if (list.length === 0) at("indicators", "required");
        else if (list.length > max) at("indicators", "count");
        else if (list.some((code) => !codes.has(code))) at("indicators", "unknown");
      };
      switch (type) {
        case "text": {
          const assignee = block.assignee ? String(block.assignee) : undefined;
          if (assignee && !assignees.has(assignee)) at("assignee", "unknown");
          // Comments have their own endpoints, so the stored thread is kept.
          const previous = stored.find((item) => item.id === id && item.type === "text");
          return {
            id,
            type,
            html: String(block.html ?? ""),
            ...(assignee ? { assignee } : {}),
            comments: previous?.type === "text" ? previous.comments : [],
          };
        }
        case "kpis":
          checkList(6);
          return { id, type, indicators: list };
        case "chart": {
          checkOne();
          const area = block.area ? String(block.area) : undefined;
          if (area && !deps.areaCodes.includes(area)) at("area", "unknown");
          return { id, type, indicator, ...(area ? { area } : {}), ...(years ? { years } : {}) };
        }
        case "map": {
          checkOne();
          const year = block.year ? String(block.year) : undefined;
          if (year && !/^\d{4}$/.test(year)) at("year", "format");
          return { id, type, indicator, ...(year ? { year } : {}) };
        }
        case "table":
          checkList(4);
          return { id, type, indicators: list, ...(years ? { years } : {}) };
      }
    });
    return { errors, value };
  };
  const findReport = (id: string) => content.reports.find((item) => item.id === id);
  const textBlock = (report: StoredReport, id: string) => {
    const block = report.blocks.find((item) => item.id === id);
    return block?.type === "text" ? block : undefined;
  };

  return [
    // ---- Dashboards ----
    authed("get", "/dashboards", ({ user, locale }) => {
      if (!guard(user)) return forbidden();
      return HttpResponse.json(
        [...content.dashboards]
          .sort((a, b) => b.updated.localeCompare(a.updated))
          .map((item): DashboardAdminSummary => ({
            slug: item.slug,
            title: pick(item.title, locale),
            audience: item.audience,
            widgetCount: item.widgets.length,
            status: item.status,
            updated: item.updated,
          })),
      );
    }),

    authed("post", "/dashboards", async ({ user, request }) => {
      if (!guard(user)) return forbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<StoredDashboard>;
      const errors: FieldError[] = [];
      const slug = String(input.slug ?? "").trim();
      if (!slug) errors.push({ path: "slug", message: "required" });
      else if (!SLUG.test(slug)) errors.push({ path: "slug", message: "format" });
      else if (findDashboard(slug)) errors.push({ path: "slug", message: "duplicate" });
      const checked = dashboardErrors({ ...input, widgets: [] });
      errors.push(...checked.errors);
      if (errors.length) return invalid(errors);
      const item: StoredDashboard = { slug, ...checked.value, status: "draft", updated: now() };
      content.dashboards.push(item);
      return HttpResponse.json(dashboardAdmin(item), { status: 201 });
    }),

    authed("get", "/dashboards/:slug", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findDashboard(params.slug!);
      return item ? HttpResponse.json(dashboardAdmin(item)) : problem(404, "Not found");
    }),

    authed("put", "/dashboards/:slug", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const item = findDashboard(params.slug!);
      if (!item) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Partial<DashboardRecord>;
      const checked = dashboardErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      Object.assign(item, checked.value, { updated: now() });
      if (item.live) {
        item.status =
          JSON.stringify(record(item)) === JSON.stringify(item.live) ? "published" : "changed";
      }
      return HttpResponse.json(dashboardAdmin(item));
    }),

    authed("post", "/dashboards/:slug/publish", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findDashboard(params.slug!);
      if (!item) return problem(404, "Not found");
      const checked = dashboardErrors(item);
      if (checked.errors.length) return invalid(checked.errors);
      if (item.widgets.length === 0) return typed(422, "empty", "Add a widget first");
      item.live = clone(record(item));
      item.status = "published";
      item.publishedAt = item.updated = now();
      writePublicDashboard(item);
      deps.revalidate(dashboardTags(item.slug));
      return HttpResponse.json(dashboardAdmin(item));
    }),

    authed("post", "/dashboards/:slug/unpublish", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findDashboard(params.slug!);
      if (!item) return problem(404, "Not found");
      delete item.live;
      delete item.publishedAt;
      item.status = "draft";
      item.updated = now();
      const index = deps.publicDashboards.findIndex((dashboard) => dashboard.slug === item.slug);
      if (index >= 0) deps.publicDashboards.splice(index, 1);
      deps.revalidate(dashboardTags(item.slug));
      return HttpResponse.json(dashboardAdmin(item));
    }),

    // ---- Publications ----
    authed("get", "/publications", ({ user, locale }) => {
      if (!guard(user)) return forbidden();
      return HttpResponse.json(
        [...content.publications]
          .map(settle)
          .sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated))
          .map((item): PublicationAdminSummary => ({
            slug: item.slug,
            title: pick(item.title, locale),
            type: item.type,
            period: item.period,
            date: item.date,
            published: item.published,
            signature: item.signature,
            updated: item.updated,
          })),
      );
    }),

    authed("post", "/publications", async ({ user, request }) => {
      if (!guard(user)) return forbidden();
      const form = await request.formData().catch(() => null);
      if (!form) return invalid([{ path: "file", message: "required" }]);
      let meta: Partial<PublicationRecord & { slug: string }> = {};
      try {
        meta = JSON.parse(String(form.get("meta") ?? "{}"));
      } catch {
        return invalid([{ path: "meta", message: "format" }]);
      }
      const checked = publicationErrors(meta);
      const errors = [...checked.errors];
      const slug = String(meta.slug ?? "").trim();
      if (!slug) errors.push({ path: "slug", message: "required" });
      else if (!SLUG.test(slug)) errors.push({ path: "slug", message: "format" });
      else if (findPublication(slug)) errors.push({ path: "slug", message: "duplicate" });
      const file = await readFile(form.get("file"));
      const cover = await readFile(form.get("cover"));
      const fileProblem = pdfError(file);
      if (fileProblem) errors.push({ path: "file", message: fileProblem });
      const coverProblem = coverError(cover);
      if (coverProblem) errors.push({ path: "cover", message: coverProblem });
      if (errors.length) return invalid(errors);
      const item: StoredPublication = {
        slug,
        ...checked.value,
        published: false,
        file: { ...file!, type: "application/pdf" },
        ...(cover ? { cover } : {}),
        signature: "pending",
        signsAt: Date.now() + SIGNING_MS,
        updated: now(),
      };
      content.publications.push(item);
      return HttpResponse.json(publicationAdmin(item), { status: 201 });
    }),

    authed("get", "/publications/:slug", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findPublication(params.slug!);
      return item ? HttpResponse.json(publicationAdmin(item)) : problem(404, "Not found");
    }),

    authed("put", "/publications/:slug", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const item = findPublication(params.slug!);
      if (!item) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Partial<PublicationRecord>;
      const checked = publicationErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      Object.assign(item, { ...checked.value, updated: now() });
      if (!checked.value.pillar) delete item.pillar;
      if (item.published) {
        writePublicPublication(item);
        deps.revalidate(publicationTags(item.slug));
      }
      return HttpResponse.json(publicationAdmin(item));
    }),

    // Replacing a file sends it to be signed again, so it's refused while the old one is live.
    authed("post", "/publications/:slug/files", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const item = findPublication(params.slug!);
      if (!item) return problem(404, "Not found");
      if (item.published) return typed(409, "published", "Unpublish before replacing the file");
      const form = await request.formData().catch(() => null);
      const file = await readFile(form?.get("file") ?? null);
      const cover = await readFile(form?.get("cover") ?? null);
      const errors: FieldError[] = [];
      if (file) {
        const fileProblem = pdfError(file);
        if (fileProblem) errors.push({ path: "file", message: fileProblem });
      }
      const coverProblem = coverError(cover);
      if (coverProblem) errors.push({ path: "cover", message: coverProblem });
      if (!file && !cover) errors.push({ path: "file", message: "required" });
      if (errors.length) return invalid(errors);
      if (file) {
        item.file = { ...file, type: "application/pdf" };
        item.signature = "pending";
        delete item.signedAt;
        item.signsAt = Date.now() + SIGNING_MS;
      }
      if (cover) item.cover = cover;
      item.updated = now();
      return HttpResponse.json(publicationAdmin(item));
    }),

    authed("get", "/publications/:slug/file", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findPublication(params.slug!);
      return item ? fileResponse(item.file) : problem(404, "Not found");
    }),

    authed("get", "/publications/:slug/cover", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findPublication(params.slug!);
      if (!item) return problem(404, "Not found");
      return item.cover ? fileResponse(item.cover) : placeholderCover();
    }),

    authed("post", "/publications/:slug/publish", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findPublication(params.slug!);
      if (!item) return problem(404, "Not found");
      settle(item);
      if (item.signature !== "signed") return typed(409, "unsigned", "The file isn't signed yet");
      item.published = true;
      item.updated = now();
      writePublicPublication(item);
      deps.revalidate(publicationTags(item.slug));
      return HttpResponse.json(publicationAdmin(item));
    }),

    authed("post", "/publications/:slug/unpublish", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findPublication(params.slug!);
      if (!item) return problem(404, "Not found");
      item.published = false;
      item.updated = now();
      const index = deps.publicPublications.findIndex(
        (publication) => publication.slug === item.slug,
      );
      if (index >= 0) deps.publicPublications.splice(index, 1);
      deps.revalidate(publicationTags(item.slug));
      return HttpResponse.json(publicationAdmin(item));
    }),

    // ---- Reports ----
    authed("get", "/reports", ({ user }) => {
      if (!guard(user)) return forbidden();
      return HttpResponse.json(
        [...content.reports].sort((a, b) => b.updated.localeCompare(a.updated)).map(reportSummary),
      );
    }),

    authed("post", "/reports", async ({ user, request }) => {
      if (!guard(user)) return forbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<StoredReport>;
      const errors: FieldError[] = [];
      const template =
        input.template === "annual" || input.template === "quarterly" ? input.template : null;
      if (!template)
        errors.push({ path: "template", message: input.template ? "unknown" : "required" });
      const period = String(input.period ?? "").trim();
      if (!period) errors.push({ path: "period", message: "required" });
      else if (template && !PERIOD[template]!.test(period))
        errors.push({ path: "period", message: "format" });
      const title = String(input.title ?? "").trim();
      if (!title) errors.push({ path: "title", message: "required" });
      if (errors.length) return invalid(errors);
      const headline = deps.indicatorCodes();
      const item: StoredReport = {
        id: `REP-${content.reports.length + 1}`,
        title,
        template: template!,
        period,
        blocks: templateBlocks(
          template!,
          headline.slice(0, 6),
          deps.areaCodes[0] ?? "",
          defaultLocale,
        ),
        createdBy: user.id,
        updated: now(),
      };
      content.reports.push(item);
      return HttpResponse.json(reportAdmin(item), { status: 201 });
    }),

    authed("get", "/reports/:id", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const item = findReport(params.id!);
      return item ? HttpResponse.json(reportAdmin(item)) : problem(404, "Not found");
    }),

    authed("put", "/reports/:id", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const item = findReport(params.id!);
      if (!item) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Partial<StoredReport>;
      const errors: FieldError[] = [];
      const title = String(input.title ?? "").trim();
      if (!title) errors.push({ path: "title", message: "required" });
      const period = String(input.period ?? "").trim();
      if (!period) errors.push({ path: "period", message: "required" });
      else if (!PERIOD[item.template]!.test(period))
        errors.push({ path: "period", message: "format" });
      const blocks = blockErrors(input.blocks, item.blocks);
      errors.push(...blocks.errors);
      if (errors.length) return invalid(errors);
      Object.assign(item, { title, period, blocks: blocks.value, updated: now() });
      return HttpResponse.json(reportAdmin(item));
    }),

    authed("post", "/reports/:id/blocks/:block/comments", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const report = findReport(params.id!);
      const block = report && textBlock(report, params.block!);
      if (!report || !block) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as { text?: string };
      const text = String(input.text ?? "").trim();
      if (!text) return invalid([{ path: "text", message: "required" }]);
      if (text.length > 2000) return invalid([{ path: "text", message: "length" }]);
      const comment: ReportComment = {
        id: `c${Date.now().toString(36)}${block.comments.length}`,
        author: { id: user.id, name: user.name },
        date: now(),
        text,
        resolved: false,
      };
      block.comments.push(comment);
      report.updated = now();
      return HttpResponse.json(comment, { status: 201 });
    }),

    authed(
      "patch",
      "/reports/:id/blocks/:block/comments/:comment",
      async ({ user, params, request }) => {
        if (!guard(user)) return forbidden();
        const report = findReport(params.id!);
        const block = report && textBlock(report, params.block!);
        const comment = block?.comments.find((item) => item.id === params.comment);
        if (!report || !comment) return problem(404, "Not found");
        const input = (await request.json().catch(() => ({}))) as { resolved?: boolean };
        comment.resolved = Boolean(input.resolved);
        return HttpResponse.json(comment);
      },
    ),

    authed("post", "/reports/:id/exports", async ({ user, params, request }) => {
      if (!guard(user)) return forbidden();
      const report = findReport(params.id!);
      if (!report) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as { format?: string };
      if (input.format !== "pdf" && input.format !== "docx")
        return invalid([{ path: "format", message: "unknown" }]);
      const jobId = `X${content.exports.size + 1}`;
      content.exports.set(jobId, { polls: 0, format: input.format, report: report.id });
      return HttpResponse.json({ jobId }, { status: 202 });
    }),

    authed("get", "/exports/:job", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const job = content.exports.get(params.job!);
      if (!job) return problem(404, "Not found");
      job.polls += 1;
      const done = job.polls >= POLLS_UNTIL_DONE;
      const body: ExportJob = done
        ? { status: "done", progress: 1, url: `/admin/exports/${params.job}/file` }
        : {
            status: job.polls === 1 ? "queued" : "running",
            progress: (job.polls - 1) / POLLS_UNTIL_DONE,
          };
      return HttpResponse.json(body);
    }),

    authed("get", "/exports/:job/file", ({ user, params }) => {
      if (!guard(user)) return forbidden();
      const job = content.exports.get(params.job!);
      const report = job && findReport(job.report);
      if (!job || !report) return problem(404, "Not found");
      // The mock can't write DOCX, so it sends a text file standing in for it; the PDF is empty.
      return job.format === "pdf"
        ? fileResponse(
            { name: `${report.id}.pdf`, type: "application/pdf", data: MINIMAL_PDF },
            false,
          )
        : fileResponse(
            {
              name: `${report.id}.txt`,
              type: "text/plain; charset=utf-8",
              data: new TextEncoder().encode(
                `${report.title}\n\nMock export: the backend generates the DOCX file.\n`,
              ),
            },
            false,
          );
    }),
  ];
}

export function placeholderCover() {
  return new HttpResponse(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#DDE2E8"/></svg>`,
    { headers: { "Content-Type": "image/svg+xml" } },
  );
}
