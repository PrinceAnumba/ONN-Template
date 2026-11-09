// Back-office intake mock (brief §7): the file import wizard and the manual entry grid. Both end
// in an ordinary submission, so the 7b workflow (verify, approve, publish) takes over from there.
import { can } from "@onn/api-client/permissions";
import {
  nextPeriod,
  parseNumber,
  previousPeriod,
  validPeriod,
  valueIssues,
} from "@onn/api-client/quality";
import type {
  EntryCell,
  EntryIndicator,
  EntryRow,
  EntrySaveResult,
  EntrySheet,
  ImportColumn,
  ImportField,
  ImportFix,
  ImportFormat,
  ImportIssue,
  ImportJob,
  ImportSummary,
  ObsStatus,
  Page,
  Periodicity,
  SubmissionStatus,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type { AdminState, StoredSubmission, StoredUser } from "./admin-seed";
import type { StoredRow } from "./admin-submissions";
import type { RouteContext } from "./admin";

type Method = "get" | "post" | "put" | "patch" | "delete";

export interface CatalogueIndicator {
  code: string;
  name: unknown;
  /** The unit as observations store it ("%" drives the range rule). */
  unit: string;
  periodicity: Periodicity;
  disaggregations: string[];
}

export interface IntakeDeps {
  authed: (
    method: Method,
    path: string,
    resolver: (ctx: RouteContext & { user: StoredUser }) => Response | Promise<Response>,
  ) => RequestHandler;
  localise: <T>(value: unknown, locale: string) => T;
  problem: (status: number, title: string, detail?: string) => Response;
  state: AdminState;
  iso3: string;
  indicators: CatalogueIndicator[];
  areas: { code: string; name: unknown; level: string }[];
  /** Published values for one series, oldest first. */
  series: (
    indicator: string,
    area: string,
    dims: Record<string, string>,
  ) => { period: string; value: number | null }[];
  /** Breakdowns published for an indicator at national level. */
  breakdowns: (indicator: string) => Record<string, string>[];
  orgName: (code: string, locale: string) => string;
  userName: (id: string) => string;
}

/** Imports parse and validate "in the background": the next poll after this delay finds them done. */
const WORK_MS = 700;
const PREVIEW_ROWS = 20;
const MAX_BYTES = 50 * 1024 * 1024;
const FLAGS: ObsStatus[] = ["A", "E", "P", "B", "F", "M"];
/** Header spellings the matcher recognises, normalised (lower case, no accents or spaces). */
const SYNONYMS: Record<string, string[]> = {
  indicator: ["indicator", "indicateur", "code", "indicatorcode", "codeindicateur"],
  area: ["area", "zone", "region", "geo", "geography", "areacode", "codezone", "refarea"],
  period: ["period", "periode", "year", "annee", "date", "timeperiod"],
  value: ["value", "valeur", "obsvalue"],
  flag: ["flag", "status", "statut", "obsstatus"],
  "dim:sex": ["sex", "sexe", "gender", "genre"],
  "dim:age_group": ["agegroup", "age", "trancheage", "tranchedage"],
  "dim:area": ["location", "milieu", "urbanrural", "milieuderesidence"],
  "dim:operator": ["operator", "operateur"],
};

export interface StoredImport {
  id: string;
  org: string;
  fileName: string;
  format: ImportFormat;
  bytes: number;
  status: ImportJob["status"];
  created: string;
  createdBy: string;
  header: string[];
  data: string[][];
  columns: ImportColumn[];
  /** Data rows (1-based) removed while fixing. */
  removed: Set<number>;
  readyAt: number;
  error?: ImportJob["error"];
  submission?: string;
}

const normalise = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Splits CSV text, detecting `,` or `;` and honouring quotes. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") + 1 || undefined);
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows.map((cells) => cells.map((value) => value.trim()));
}

/** Objects in an array (or under `rows`, `data` or `observations`) become rows. */
function parseJson(text: string): string[][] {
  const parsed = JSON.parse(text) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : ((parsed as Record<string, unknown>).rows ??
      (parsed as Record<string, unknown>).data ??
      (parsed as Record<string, unknown>).observations);
  if (!Array.isArray(list)) throw new Error("No list of rows");
  const objects = list.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === "object",
  );
  const header = [...new Set(objects.flatMap((item) => Object.keys(item)))];
  return [header, ...objects.map((item) => header.map((key) => String(item[key] ?? "")))];
}

/** Each repeated element under the root is a row and its child elements are the cells. */
function parseXml(text: string): string[][] {
  const body = text
    .replace(/<\?xml[^>]*\?>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const inner = /^<([\w:-]+)[^>]*>([\s\S]*)<\/\1>$/.exec(body)?.[2];
  if (inner === undefined) throw new Error("No root element");
  const records = [...inner.matchAll(/<([\w:-]+)[^>]*>([\s\S]*?)<\/\1>/g)].map((match) =>
    Object.fromEntries(
      [...(match[2] ?? "").matchAll(/<([\w:-]+)[^>]*>([^<]*)<\/\1>/g)].map((cell) => [
        cell[1]!,
        (cell[2] ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim(),
      ]),
    ),
  );
  const header = [...new Set(records.flatMap((item) => Object.keys(item)))];
  return [header, ...records.map((item) => header.map((key) => item[key] ?? ""))];
}

export function formatOf(name: string): ImportFormat | null {
  const ext = name.toLowerCase().split(".").pop();
  return ext === "csv" || ext === "xlsx" || ext === "json" || ext === "xml" ? ext : null;
}

export function autoMatch(header: string[], targets: ImportField[]): ImportColumn[] {
  const used = new Set<ImportField>();
  return header.map((source) => {
    const key = normalise(source);
    const target = targets.find(
      (field) =>
        !used.has(field) &&
        (SYNONYMS[field]?.includes(key) ??
          (field.startsWith("dim:") && normalise(field.slice(4)) === key)),
    );
    if (target) used.add(target);
    return { source, target: target ?? "ignore", auto: Boolean(target) };
  });
}

export function createIntakeHandlers(deps: IntakeDeps) {
  const { authed, localise, problem, state, iso3, orgName, userName } = deps;
  const indicatorByCode = new Map(deps.indicators.map((item) => [item.code, item]));
  const areaByCode = new Map(deps.areas.map((item) => [item.code, item]));
  const adm1 = deps.areas.filter((area) => area.level === "adm1").map((area) => area.code);
  const imports = state.imports;

  const indicatorsOf = (org: string) =>
    deps.indicators.filter((item) => state.indicatorOrg[item.code] === org);

  const targetsFor = (org: string): ImportField[] => {
    const dims = [...new Set(indicatorsOf(org).flatMap((item) => item.disaggregations))];
    return [
      "indicator",
      "area",
      "period",
      "value",
      "flag",
      ...dims.map((dim) => `dim:${dim}` as ImportField),
      "ignore",
    ];
  };

  const publishedAt = (
    indicator: string,
    area: string,
    dims: Record<string, string>,
    period: string,
  ) => {
    const series = deps.series(indicator, area, dims);
    const current = series.find((item) => item.period === period)?.value ?? null;
    const before =
      series.filter((item) => item.period < period && item.value !== null).at(-1)?.value ?? null;
    return { current, before };
  };

  // ---- Imports ----

  /** Moves a job on once its background work is "done". */
  const advance = (job: StoredImport) => {
    if (Date.now() < job.readyAt) return;
    if (job.status === "parsing") job.status = job.error ? "failed" : "mapping";
    else if (job.status === "validating") job.status = "validated";
  };

  /** Row-level issues and the rows that would be submitted. */
  const validate = (job: StoredImport) => {
    const issues: ImportIssue[] = [];
    const rows: StoredRow[] = [];
    const seen = new Map<string, number>();
    const columnOf = (field: ImportField) =>
      job.columns.findIndex((column) => column.target === field);
    const dimFields = job.columns.filter((column) => column.target.startsWith("dim:"));
    job.data.forEach((cells, index) => {
      const row = index + 1;
      if (job.removed.has(row)) return;
      const cell = (field: ImportField) => cells[columnOf(field)] ?? "";
      const add = (
        field: ImportField,
        rule: ImportIssue["rule"],
        level: ImportIssue["level"] = "error",
      ) => issues.push({ row, field, rule, level, value: cell(field) });
      const before = issues.length;
      const code = cell("indicator");
      const indicator = indicatorByCode.get(code);
      if (!indicator) add("indicator", "indicator");
      else if (state.indicatorOrg[code] !== job.org) add("indicator", "permission");
      const area = cell("area");
      if (!areaByCode.has(area)) add("area", "area");
      const period = cell("period");
      if (!indicator || !validPeriod(period, indicator.periodicity)) {
        if (indicator) add("period", "period");
      }
      const dims = Object.fromEntries(
        dimFields
          .map(
            (column) => [column.target.slice(4), cells[job.columns.indexOf(column)] ?? ""] as const,
          )
          .filter(([, value]) => value && normalise(value) !== "total"),
      );
      const key = `${code}|${area}|${period}|${JSON.stringify(dims)}`;
      if (seen.has(key)) add("value", "duplicate");
      else seen.set(key, row);
      const parsed = parseNumber(cell("value"));
      if (Number.isNaN(parsed)) add("value", "number");
      else if (indicator) {
        const { current, before: previous } = publishedAt(code, area, dims, period);
        for (const issue of valueIssues(parsed, indicator.unit, current ?? previous)) {
          add("value", issue.rule, issue.level);
        }
      }
      if (issues.slice(before).some((issue) => issue.level === "error") || !indicator) return;
      const flag = cell("flag").toUpperCase() as ObsStatus;
      rows.push({
        id: `${job.id}-${row}`,
        indicator: code,
        area,
        period,
        dims,
        value: parsed,
        unit: indicator.unit,
        status: FLAGS.includes(flag) ? flag : "P",
        published: publishedAt(code, area, dims, period).current,
      });
    });
    const errorRows = new Set(
      issues.filter((issue) => issue.level === "error").map((issue) => issue.row),
    );
    const warningRows = new Set(
      issues.filter((issue) => issue.level === "warning").map((issue) => issue.row),
    );
    const live = job.data.length - job.removed.size;
    return {
      issues,
      rows,
      counts: { errors: errorRows.size, warnings: warningRows.size, valid: live - errorRows.size },
    };
  };

  const importSummary = (job: StoredImport, locale: string): ImportSummary => {
    advance(job);
    const validated = job.status === "validated" || job.status === "submitted";
    return {
      id: job.id,
      org: job.org,
      orgName: orgName(job.org, locale),
      fileName: job.fileName,
      format: job.format,
      bytes: job.bytes,
      status: job.status,
      created: job.created,
      createdBy: { id: job.createdBy, name: userName(job.createdBy) },
      rowCount: job.data.length - job.removed.size,
      ...(validated ? { counts: validate(job).counts } : {}),
      ...(job.submission ? { submission: job.submission } : {}),
    };
  };

  const importJob = (job: StoredImport, locale: string): ImportJob => {
    const summary = importSummary(job, locale);
    const validated = job.status === "validated" || job.status === "submitted";
    return {
      ...summary,
      columns: job.status === "parsing" ? [] : job.columns,
      targets: targetsFor(job.org),
      preview: job.status === "parsing" ? [] : job.data.slice(0, PREVIEW_ROWS),
      ...(validated
        ? {
            rows: job.data.map((cells, index) => (job.removed.has(index + 1) ? [] : cells)),
            issues: validate(job).issues,
          }
        : {}),
      ...(job.error && job.status === "failed" ? { error: job.error } : {}),
    };
  };

  const findImport = (user: StoredUser, id: string) => {
    const job = imports.find((item) => item.id === id);
    return job && user.orgs.includes(job.org) ? job : undefined;
  };

  const nextSubmissionId = () =>
    `SUB-${String(
      Math.max(0, ...state.submissions.map((item) => Number(item.id.slice(4)) || 0)) + 1,
    ).padStart(4, "0")}`;

  // ---- Entry ----

  const entryDraft = (org: string, indicator: string, period: string) =>
    state.submissions.find(
      (item) =>
        item.channel === "entry" &&
        item.org === org &&
        item.period === period &&
        item.indicators.length === 1 &&
        item.indicators[0] === indicator &&
        item.status !== "published",
    );

  const latestOf = (code: string) =>
    deps
      .series(code, iso3, {})
      .filter((item) => item.value !== null)
      .at(-1)?.period;
  const nextOf = (indicator: CatalogueIndicator) => {
    const latest = latestOf(indicator.code);
    return latest ? nextPeriod(latest, indicator.periodicity) : String(new Date().getUTCFullYear());
  };

  const sheet = (
    indicator: CatalogueIndicator,
    org: string,
    period: string,
    locale: string,
  ): EntrySheet => {
    const periods = [
      previousPeriod(previousPeriod(period, indicator.periodicity), indicator.periodicity),
      previousPeriod(period, indicator.periodicity),
      period,
    ];
    const draft = entryDraft(org, indicator.code, period);
    const areas = [iso3, ...adm1.filter((area) => deps.series(indicator.code, area, {}).length)];
    const groups: Record<string, string>[] = [{}, ...deps.breakdowns(indicator.code)];
    const rows: EntryRow[] = [];
    for (const dims of groups) {
      for (const area of Object.keys(dims).length ? [iso3] : areas) {
        const series = deps.series(indicator.code, area, dims);
        const published = Object.fromEntries(
          periods.map((p) => [p, series.find((item) => item.period === p)?.value ?? null]),
        );
        const values = { ...published };
        for (const row of draft?.rows ?? []) {
          if (
            row.area === area &&
            JSON.stringify(row.dims) === JSON.stringify(dims) &&
            row.period in values
          ) {
            values[row.period] = row.value;
          }
        }
        rows.push({
          key: `${area}|${Object.entries(dims)
            .map(([k, v]) => `${k}=${v}`)
            .join(",")}`,
          area,
          areaName: localise<string>(areaByCode.get(area)?.name ?? area, locale),
          dims,
          values,
          published,
          before:
            series.filter((item) => item.period < periods[0]! && item.value !== null).at(-1)
              ?.value ?? null,
        });
      }
    }
    const open: SubmissionStatus[] = ["draft", "returned"];
    return {
      indicator: {
        code: indicator.code,
        name: localise<string>(indicator.name, locale),
        unit: indicator.unit,
        periodicity: indicator.periodicity,
      },
      org,
      orgName: orgName(org, locale),
      periods,
      rows,
      ...(draft
        ? { draft: { submission: draft.id, status: draft.status, updated: draft.updated } }
        : {}),
      ...(draft && !open.includes(draft.status) ? { locked: draft.status } : {}),
    };
  };

  /** The organisation an entry request is for: `?org=` if allowed, else the indicator's own. */
  const entryOrg = (user: StoredUser, code: string) => {
    const org = state.indicatorOrg[code];
    return org && user.orgs.includes(org) ? org : undefined;
  };

  return [
    authed("get", "/imports", ({ user, q, locale }) => {
      const org = q.get("org");
      const rows = imports
        .filter((job) => user.orgs.includes(job.org) && (!org || job.org === org))
        .sort((a, b) => b.created.localeCompare(a.created));
      const pageSize = [25, 50, 100].includes(Number(q.get("pageSize")))
        ? Number(q.get("pageSize"))
        : 25;
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      const page = Math.min(Math.max(1, Number(q.get("page")) || 1), pages);
      const body: Page<ImportSummary> = {
        items: rows
          .slice((page - 1) * pageSize, page * pageSize)
          .map((job) => importSummary(job, locale)),
        meta: { total: rows.length, page, pageSize },
      };
      return HttpResponse.json(body);
    }),

    /** A CSV template for one organisation's indicators; `demo=errors` fills it with five
     * seeded errors for trying the wizard (mock only). */
    authed("get", "/imports/template", ({ user, q }) => {
      const org = q.get("org") ?? "";
      if (!user.orgs.includes(org)) return problem(404, "Not found", "Unknown organisation");
      const demo = q.get("demo") === "errors";
      const lines: string[][] = [];
      for (const indicator of indicatorsOf(org)) {
        const latest = latestOf(indicator.code);
        if (!latest) continue;
        const period = nextPeriod(latest, indicator.periodicity);
        for (const area of [
          iso3,
          ...adm1.filter((code) => deps.series(indicator.code, code, {}).length).slice(0, 3),
        ]) {
          const last = deps
            .series(indicator.code, area, {})
            .filter((item) => item.value !== null)
            .at(-1)?.value;
          const raised =
            last === undefined || last === null ? null : Math.round(last * 1.04 * 10) / 10;
          const grown =
            raised === null ? "" : String(indicator.unit === "%" ? Math.min(100, raised) : raised);
          lines.push([indicator.code, area, period, demo ? grown : "", demo ? "P" : ""]);
        }
      }
      if (demo && lines.length >= 6) {
        lines[1]![1] = `${iso3}-XX`; // unknown area
        lines[2]![3] = "n/a"; // text in a value cell
        lines[3]![3] = `-${lines[3]![3]}`; // negative
        lines[4]![0] = "UNKNOWN.CODE"; // unknown indicator
        lines.push([...lines[0]!]); // duplicate of the first row
      }
      const csv = [["indicator", "area", "period", "value", "flag"], ...lines]
        .map((cells) => cells.join(","))
        .join("\r\n");
      return new HttpResponse(`${csv}\r\n`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="template-${org}${demo ? "-demo" : ""}.csv"`,
        },
      });
    }),

    authed("post", "/imports", async ({ user, request, locale }) => {
      if (!can(user.roles, "submission.submit"))
        return problem(403, "Forbidden", "Your role can't import");
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      const org = String(form?.get("org") ?? "");
      if (!(file instanceof File)) return problem(422, "No file", "Attach a file");
      if (!user.orgs.includes(org))
        return problem(422, "Organisation", "Choose one of your organisations");
      const format = formatOf(file.name);
      if (!format) return problem(415, "Unsupported format", "Use CSV, XLSX, JSON or XML");
      if (file.size > MAX_BYTES) return problem(413, "Too large", "The limit is 50 MB");
      let table: string[][] = [];
      let error: StoredImport["error"];
      try {
        if (format === "xlsx") error = "unsupported";
        else {
          const text = (await file.text()).replace(/^\ufeff/, "");
          table =
            format === "csv"
              ? parseCsv(text)
              : format === "json"
                ? parseJson(text)
                : parseXml(text);
          if (table.length < 2) error = "empty";
        }
      } catch {
        error = "format";
      }
      const header = table[0] ?? [];
      const job: StoredImport = {
        id: `IMP-${String(imports.length + 1).padStart(4, "0")}`,
        org,
        fileName: file.name.slice(0, 200),
        format,
        bytes: file.size,
        status: "parsing",
        created: new Date().toISOString(),
        createdBy: user.id,
        header,
        data: table.slice(1).map((row) => header.map((_, index) => row[index] ?? "")),
        columns: autoMatch(header, targetsFor(org)),
        removed: new Set(),
        readyAt: Date.now() + WORK_MS,
        ...(error ? { error } : {}),
      };
      imports.push(job);
      return HttpResponse.json(importJob(job, locale), { status: 201 });
    }),

    authed("get", "/imports/:id", ({ user, params, locale }) => {
      const job = findImport(user, params.id!);
      return job ? HttpResponse.json(importJob(job, locale)) : problem(404, "Not found");
    }),

    authed("put", "/imports/:id/mapping", async ({ user, params, request, locale }) => {
      const job = findImport(user, params.id!);
      if (!job) return problem(404, "Not found");
      advance(job);
      if (!["mapping", "validated"].includes(job.status))
        return problem(409, "Not ready", `Import is ${job.status}`);
      const body = (await request.json().catch(() => null)) as {
        columns?: Record<string, ImportField>;
      } | null;
      const targets = targetsFor(job.org);
      const columns = job.columns.map((column) => {
        const target = body?.columns?.[column.source];
        return target && targets.includes(target)
          ? { ...column, target, auto: target === column.target && column.auto }
          : column;
      });
      const required: ImportField[] = ["indicator", "area", "period", "value"];
      const missing = required.filter(
        (field) => !columns.some((column) => column.target === field),
      );
      const doubled = columns
        .map((column) => column.target)
        .filter((target, index, all) => target !== "ignore" && all.indexOf(target) !== index);
      if (missing.length || doubled.length) {
        return HttpResponse.json(
          {
            type: "mapping",
            title: "Mapping incomplete",
            status: 422,
            detail: missing.length
              ? `Map: ${missing.join(", ")}`
              : `Mapped twice: ${doubled.join(", ")}`,
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      job.columns = columns;
      job.status = "validating";
      job.readyAt = Date.now() + WORK_MS;
      return HttpResponse.json(importJob(job, locale));
    }),

    /** Fixes cells or removes rows, then validates again at once. */
    authed("patch", "/imports/:id/rows", async ({ user, params, request, locale }) => {
      const job = findImport(user, params.id!);
      if (!job) return problem(404, "Not found");
      advance(job);
      if (job.status !== "validated") return problem(409, "Not ready", `Import is ${job.status}`);
      const body = (await request.json().catch(() => null)) as {
        fixes?: ImportFix[];
        remove?: number[];
      } | null;
      for (const fix of body?.fixes ?? []) {
        const column = job.columns.findIndex((item) => item.target === fix.field);
        const row = job.data[fix.row - 1];
        if (row && column > -1) row[column] = String(fix.value).slice(0, 200);
      }
      for (const row of body?.remove ?? [])
        if (row >= 1 && row <= job.data.length) job.removed.add(row);
      return HttpResponse.json(importJob(job, locale));
    }),

    authed("post", "/imports/:id/submit", async ({ user, params, request }) => {
      const job = findImport(user, params.id!);
      if (!job) return problem(404, "Not found");
      advance(job);
      if (job.status !== "validated") return problem(409, "Not ready", `Import is ${job.status}`);
      const result = validate(job);
      if (result.counts.errors) {
        return HttpResponse.json(
          {
            type: "errors",
            title: "Errors remain",
            status: 422,
            detail: `${result.counts.errors} rows have errors`,
          },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      if (!result.rows.length) return problem(422, "Nothing to submit", "No valid rows");
      const body = (await request.json().catch(() => null)) as { comment?: string } | null;
      const comment = body?.comment?.trim().slice(0, 2000);
      const id = nextSubmissionId();
      const now = new Date();
      const periods = result.rows.map((row) => row.period).sort();
      const submission: StoredSubmission = {
        id,
        org: job.org,
        indicators: [...new Set(result.rows.map((row) => row.indicator))],
        period: periods.at(-1)!,
        channel: "import",
        status: "submitted",
        submittedBy: user.id,
        updated: now.toISOString(),
        rows: result.rows.map((row, index) => ({ ...row, id: `${id}-${index + 1}` })),
        justifications: {},
        history: [
          { id: `${id}-h0`, date: now.toISOString(), to: "draft", actor: user.id },
          {
            id: `${id}-h1`,
            date: now.toISOString(),
            from: "draft",
            to: "submitted",
            actor: user.id,
            ...(comment ? { comment } : {}),
          },
        ],
      };
      state.submissions.push(submission);
      job.status = "submitted";
      job.submission = id;
      return HttpResponse.json({ submission: id }, { status: 201 });
    }),

    authed("get", "/entry", ({ user, q, locale }) => {
      const org = q.get("org");
      const orgs = org && user.orgs.includes(org) ? [org] : user.orgs;
      const body: EntryIndicator[] = deps.indicators
        .filter((item) => orgs.includes(state.indicatorOrg[item.code] ?? ""))
        .map((item) => {
          const owner = state.indicatorOrg[item.code]!;
          const next = nextOf(item);
          const draft = entryDraft(owner, item.code, next);
          const latest = latestOf(item.code);
          return {
            code: item.code,
            name: localise<string>(item.name, locale),
            unit: item.unit,
            periodicity: item.periodicity,
            org: owner,
            orgName: orgName(owner, locale),
            next,
            ...(latest ? { latest } : {}),
            ...(draft
              ? { draft: { submission: draft.id, status: draft.status, updated: draft.updated } }
              : {}),
          };
        });
      return HttpResponse.json(body);
    }),

    authed("get", "/entry/:indicator", ({ user, params, q, locale }) => {
      const indicator = indicatorByCode.get(params.indicator!);
      const org = indicator && entryOrg(user, indicator.code);
      if (!indicator || !org) return problem(404, "Not found");
      const period = q.get("period") ?? "";
      return HttpResponse.json(
        sheet(
          indicator,
          org,
          validPeriod(period, indicator.periodicity) ? period : nextOf(indicator),
          locale,
        ),
      );
    }),

    /** Saves cells into the entry draft for the period, creating it on first save. Cells equal to
     * the published value are dropped, so the draft holds only new or revised values. */
    authed("put", "/entry/:indicator", async ({ user, params, q, request }) => {
      const indicator = indicatorByCode.get(params.indicator!);
      const org = indicator && entryOrg(user, indicator.code);
      if (!indicator || !org) return problem(404, "Not found");
      if (!can(user.roles, "submission.submit"))
        return problem(403, "Forbidden", "Your role can't enter data");
      const period = q.get("period") ?? "";
      if (!validPeriod(period, indicator.periodicity))
        return problem(422, "Period", "Invalid period");
      const body = (await request.json().catch(() => null)) as { cells?: EntryCell[] } | null;
      let draft = entryDraft(org, indicator.code, period);
      if (draft && !["draft", "returned"].includes(draft.status)) {
        return HttpResponse.json(
          {
            type: "state",
            title: "Locked",
            status: 409,
            detail: `The submission is ${draft.status}`,
          },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        );
      }
      const now = new Date().toISOString();
      if (!draft) {
        const id = nextSubmissionId();
        draft = {
          id,
          org,
          indicators: [indicator.code],
          period,
          channel: "entry",
          status: "draft",
          submittedBy: user.id,
          updated: now,
          rows: [],
          justifications: {},
          history: [{ id: `${id}-h0`, date: now, to: "draft", actor: user.id }],
        };
        state.submissions.push(draft);
      }
      for (const cell of (body?.cells ?? []).slice(0, 5000)) {
        if (!areaByCode.has(cell.area) || !validPeriod(cell.period, indicator.periodicity))
          continue;
        const dims = cell.dims ?? {};
        const same = (row: StoredRow) =>
          row.area === cell.area &&
          row.period === cell.period &&
          JSON.stringify(row.dims) === JSON.stringify(dims);
        const { current } = publishedAt(indicator.code, cell.area, dims, cell.period);
        const value =
          typeof cell.value === "number" && Number.isFinite(cell.value) ? cell.value : null;
        draft.rows = draft.rows.filter((row) => !same(row));
        if (value === current) continue;
        draft.rows.push({
          id: `${draft.id}-${Date.now().toString(36)}-${draft.rows.length + 1}`,
          indicator: indicator.code,
          area: cell.area,
          period: cell.period,
          dims,
          value,
          unit: indicator.unit,
          status: "P",
          published: current,
        });
      }
      draft.updated = now;
      const result: EntrySaveResult = { submission: draft.id, saved: now };
      return HttpResponse.json(result);
    }),
  ];
}
