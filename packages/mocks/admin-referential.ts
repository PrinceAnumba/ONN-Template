// Back-office mock for Phase 7d (brief §7): connectors, the quality overview and the indicator
// referential. Connector runs end in an ordinary submission, like imports, so the 7b workflow
// takes over; saving an indicator writes its public metadata and refreshes the portal.
import { parseCron } from "@onn/api-client/cron";
import { can } from "@onn/api-client/permissions";
import { nextPeriod, valueIssues } from "@onn/api-client/quality";
import type {
  Connector,
  ConnectorDryRun,
  ConnectorInput,
  ConnectorMapping,
  ConnectorRun,
  ConnectorSummary,
  ConnectorTestResult,
  ConnectorType,
  ImportField,
  IndicatorAdmin,
  IndicatorAdminSummary,
  IndicatorCreateInput,
  IndicatorRecord,
  IndicatorStatus,
  Page,
  Periodicity,
  QualityOverview,
  QualityRate,
  QualityWarning,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type {
  AdminState,
  StoredConnector,
  StoredIndicator,
  StoredRun,
  StoredSubmission,
  StoredUser,
} from "./admin-seed";
import { SOURCE_FIELDS } from "./admin-seed";
import { autoMatch, type CatalogueIndicator } from "./admin-intake";
import { rowIssues, type StoredRow } from "./admin-submissions";
import type { RouteContext } from "./admin";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Text = Record<string, string>;
type FieldError = { path: string; message: string };

export interface StoredPillar {
  code: string;
  name: unknown;
  themes: { code: string; name: unknown }[];
}

export interface ReferentialDeps {
  authed: (
    method: Method,
    path: string,
    resolver: (ctx: RouteContext & { user: StoredUser }) => Response | Promise<Response>,
  ) => RequestHandler;
  localise: <T>(value: unknown, locale: string) => T;
  problem: (status: number, title: string, detail?: string) => Response;
  state: AdminState;
  orgName: (code: string, locale: string) => string;
  userName: (id: string) => string;
  names: { indicator: (code: string) => unknown; area: (code: string) => unknown };
  previous: (row: StoredRow) => number | null;
  iso3: string;
  indicators: CatalogueIndicator[];
  areas: { code: string; name: unknown; level: string }[];
  series: (
    indicator: string,
    area: string,
    dims: Record<string, string>,
  ) => { period: string; value: number | null }[];
  breakdowns: (indicator: string) => Record<string, string>[];
  pillars: StoredPillar[];
  locales: string[];
  defaultLocale: string;
  /** "national" plus the configured boundary levels. */
  geoLevels: string[];
  /** Writes a saved indicator into the public catalogue and refreshes the portal. */
  syncIndicator: (record: StoredIndicator) => void;
}

const DAY = 24 * 60 * 60 * 1000;
const TYPES: ConnectorType[] = ["sdmx", "rest", "sftp", "csv"];
const AUTHS = ["none", "token", "basic"] as const;
const REQUIRED: ImportField[] = ["indicator", "area", "period", "value"];
const DRY_RUN_ROWS = 50;
const STATUSES: IndicatorStatus[] = ["published", "in_collection", "planned"];
const PERIODICITIES: Periodicity[] = ["monthly", "quarterly", "annual", "biennial"];
export const DIMENSIONS = ["sex", "age_group", "area", "operator"];
const INTL_ORGS = ["ITU", "WB", "UN", "AU"] as const;
const OPEN = ["submitted", "verified", "approved", "returned"];
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = [25, 50, 100];
const CODE = /^[A-Z][A-Z0-9_]*(\.[A-Z0-9_]+)+$/;

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

/** Pass rates over submitted rows (brief §7 Quality). A row passes with no error and every
 * warning justified. Shared by the overview card and the quality page so they agree. */
export function qualityStats(
  submissions: StoredSubmission[],
  previous: (row: StoredRow) => number | null,
) {
  const rated: { submission: StoredSubmission; row: StoredRow; pass: boolean }[] = [];
  const warnings: { submission: StoredSubmission; row: StoredRow; rule: string }[] = [];
  for (const submission of submissions) {
    if (submission.status === "draft") continue;
    const issues = rowIssues(submission.rows, previous);
    for (const row of submission.rows) {
      const found = issues.get(row.id) ?? [];
      const open = found.filter(
        (issue) => issue.level === "error" || !submission.justifications[issue.rule],
      );
      rated.push({ submission, row, pass: open.length === 0 });
      if (OPEN.includes(submission.status)) {
        for (const issue of open) {
          if (issue.level === "warning") warnings.push({ submission, row, rule: issue.rule });
        }
      }
    }
  }
  return { rated, warnings };
}

export const rate = (items: { pass: boolean }[]): QualityRate => ({
  passRate: items.length ? items.filter((item) => item.pass).length / items.length : null,
  checked: items.length,
});

export function createReferentialHandlers(deps: ReferentialDeps) {
  const { authed, localise, problem, state, orgName, userName, iso3 } = deps;
  const adm1 = deps.areas.filter((area) => area.level === "adm1").map((area) => area.code);
  const unitOf = new Map(deps.indicators.map((item) => [item.code, item.unit]));
  const scope = (user: StoredUser, q: URLSearchParams) => {
    const org = q.get("org");
    return org && user.orgs.includes(org) ? [org] : user.orgs;
  };
  const deny = () => typed(403, "role", "Not allowed");

  // ---- Connectors ----

  const targetsFor = (org: string): ImportField[] => {
    const dims = [
      ...new Set(
        deps.indicators
          .filter((item) => state.indicatorOrg[item.code] === org)
          .flatMap((item) => item.disaggregations),
      ),
    ];
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

  const runOut = (run: StoredRun, locale: string): ConnectorRun => ({
    id: run.id,
    started: run.started,
    finished: run.finished,
    status: run.status,
    trigger: run.trigger,
    ...(run.by ? { by: { id: run.by, name: userName(run.by) } } : {}),
    rows: run.rows,
    ...(run.submission ? { submission: run.submission } : {}),
    ...(run.error ? { error: run.error } : {}),
    log: run.log.map((line) => ({ ...line, message: localise<string>(line.message, locale) })),
  });

  const summaryOf = (item: StoredConnector, locale: string): ConnectorSummary => {
    const last = item.runs[0];
    return {
      id: item.id,
      name: item.name,
      org: item.org,
      orgName: orgName(item.org, locale),
      type: item.type,
      schedule: item.schedule,
      enabled: item.enabled,
      ...(last
        ? {
            lastRun: {
              date: last.finished,
              status: last.status,
              rows: last.rows,
              ...(last.error ? { error: last.error } : {}),
            },
          }
        : {}),
    };
  };

  const connectorOut = (item: StoredConnector, locale: string): Connector => ({
    ...summaryOf(item, locale),
    endpoint: item.endpoint,
    auth: item.auth,
    sourceFields: item.sourceFields,
    mapping: item.mapping,
    targets: targetsFor(item.org),
    runs: item.runs.slice(0, 20).map((run) => runOut(run, locale)),
  });

  const findConnector = (user: StoredUser, id: string) =>
    state.connectors.find((item) => item.id === id && user.orgs.includes(item.org));

  const schemeOk = (type: ConnectorType, endpoint: string) => {
    try {
      const url = new URL(endpoint);
      return type === "sftp"
        ? url.protocol === "sftp:"
        : ["https:", "http:"].includes(url.protocol);
    } catch {
      return false;
    }
  };
  const broken = (endpoint: string) =>
    state.connectors.some((item) => item.brokenEndpoint && item.brokenEndpoint === endpoint);

  const mappingErrors = (mapping: ConnectorMapping[], targets: ImportField[]): FieldError[] => {
    const errors: FieldError[] = [];
    const used: ImportField[] = mapping
      .map((item) => item.target)
      .filter((target) => target !== "ignore");
    for (const field of REQUIRED) {
      if (!used.includes(field)) errors.push({ path: `mapping.${field}`, message: "required" });
    }
    mapping.forEach((item, index) => {
      if (!targets.includes(item.target)) {
        errors.push({ path: `mapping.${index}`, message: "unknown" });
      } else if (
        item.target !== "ignore" &&
        used.indexOf(item.target) !== used.lastIndexOf(item.target)
      ) {
        errors.push({ path: `mapping.${index}`, message: "duplicate" });
      }
    });
    return errors;
  };

  const connectorErrors = (input: Partial<ConnectorInput>, user: StoredUser): FieldError[] => {
    const errors: FieldError[] = [];
    if (!input.name?.trim()) errors.push({ path: "name", message: "required" });
    else if (input.name.trim().length > 80) errors.push({ path: "name", message: "length" });
    if (!input.org || !user.orgs.includes(input.org))
      errors.push({ path: "org", message: "required" });
    if (!input.type || !TYPES.includes(input.type))
      errors.push({ path: "type", message: "required" });
    if (!input.endpoint?.trim()) errors.push({ path: "endpoint", message: "required" });
    else if (input.type && !schemeOk(input.type, input.endpoint.trim())) {
      errors.push({ path: "endpoint", message: "scheme" });
    }
    if (!input.auth || !AUTHS.includes(input.auth))
      errors.push({ path: "auth", message: "required" });
    if (!input.schedule || !parseCron(input.schedule))
      errors.push({ path: "schedule", message: "cron" });
    if (input.org && user.orgs.includes(input.org)) {
      errors.push(...mappingErrors(input.mapping ?? [], targetsFor(input.org)));
    }
    return errors;
  };

  /** What the source would deliver this run, already mapped (mock data from the published series). */
  const sourceRows = (org: string, mapping: ConnectorMapping[]) => {
    const mapped = new Set(mapping.map((item) => item.target));
    const rows: ConnectorDryRun["rows"] = [];
    for (const indicator of deps.indicators.filter(
      (item) => state.indicatorOrg[item.code] === org,
    )) {
      const latest = deps
        .series(indicator.code, iso3, {})
        .filter((item) => item.value !== null)
        .at(-1)?.period;
      if (!latest) continue;
      const period = nextPeriod(latest, indicator.periodicity);
      const grow = (last: number | null | undefined) => {
        if (last === null || last === undefined) return null;
        const value = Math.round(last * 1.03 * 10) / 10;
        return indicator.unit === "%" ? Math.min(100, value) : value;
      };
      const areas = [iso3, ...adm1.filter((code) => deps.series(indicator.code, code, {}).length)];
      for (const area of areas) {
        const last = deps
          .series(indicator.code, area, {})
          .filter((item) => item.value !== null)
          .at(-1);
        rows.push({
          indicator: indicator.code,
          area,
          period,
          dims: {},
          value: grow(last?.value),
          flag: "P",
        });
      }
      for (const dims of deps.breakdowns(indicator.code)) {
        if (!Object.keys(dims).every((key) => mapped.has(`dim:${key}` as ImportField))) continue;
        const last = deps
          .series(indicator.code, iso3, dims)
          .filter((item) => item.value !== null)
          .at(-1);
        rows.push({
          indicator: indicator.code,
          area: iso3,
          period,
          dims,
          value: grow(last?.value),
          flag: "P",
        });
      }
    }
    return rows;
  };

  const issueCount = (rows: ConnectorDryRun["rows"]) =>
    rows.filter(
      (row) =>
        valueIssues(
          row.value,
          unitOf.get(row.indicator) ?? "",
          deps
            .series(row.indicator, row.area, row.dims)
            .filter((item) => item.value !== null)
            .at(-1)?.value ?? null,
        ).length > 0,
    ).length;

  const nextSubmissionId = () => {
    const max = Math.max(0, ...state.submissions.map((item) => Number(item.id.slice(4)) || 0));
    return `SUB-${String(max + 1).padStart(4, "0")}`;
  };

  const record = (item: StoredConnector, run: StoredRun) => {
    item.runs.unshift(run);
    item.lastRun = run.finished;
    item.lastStatus = run.status;
    if (run.error) item.error = run.error;
    else delete item.error;
  };

  const connectorHandlers = [
    authed("get", "/connectors", ({ user, q, locale }) => {
      if (!can(user.roles, "connector.view")) return deny();
      const orgs = scope(user, q);
      return HttpResponse.json(
        state.connectors
          .filter((item) => orgs.includes(item.org))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => summaryOf(item, locale)),
      );
    }),

    /** Tries the source with unsaved settings, so a new connector can be checked first. */
    authed("post", "/connectors/test", async ({ user, request }) => {
      if (!can(user.roles, "connector.manage")) return deny();
      const body = (await request.json().catch(() => null)) as Partial<ConnectorInput> | null;
      const type = TYPES.find((item) => item === body?.type) ?? "rest";
      const endpoint = body?.endpoint?.trim() ?? "";
      const result: ConnectorTestResult = !schemeOk(type, endpoint)
        ? { ok: false, latencyMs: 0, fields: [], error: "scheme" }
        : broken(endpoint)
          ? {
              ok: false,
              latencyMs: 30000,
              fields: [],
              error: "unreachable",
              detail: "HTTP 503 Service Unavailable",
            }
          : {
              ok: true,
              latencyMs: 120 + (endpoint.length % 7) * 23,
              fields: SOURCE_FIELDS[type],
              ...(body?.org && user.orgs.includes(body.org)
                ? {
                    targets: targetsFor(body.org),
                    suggested: autoMatch(SOURCE_FIELDS[type], targetsFor(body.org)).map(
                      ({ source, target }) => ({ source, target }),
                    ),
                  }
                : {}),
            };
      return HttpResponse.json(result);
    }),

    authed("post", "/connectors", async ({ user, request, locale }) => {
      if (!can(user.roles, "connector.manage")) return deny();
      const body = (await request.json().catch(() => null)) as Partial<ConnectorInput> | null;
      const errors = connectorErrors(body ?? {}, user);
      if (errors.length) return invalid(errors);
      const input = body as ConnectorInput;
      const max = Math.max(0, ...state.connectors.map((item) => Number(item.id.slice(4)) || 0));
      const item: StoredConnector = {
        id: `CON-${max + 1}`,
        name: input.name.trim(),
        org: input.org,
        type: input.type,
        endpoint: input.endpoint.trim(),
        auth: input.auth,
        schedule: input.schedule.trim(),
        enabled: Boolean(input.enabled),
        sourceFields: input.mapping.map((entry) => entry.source),
        mapping: input.mapping,
        runs: [],
        lastRun: "",
        lastStatus: "ok",
      };
      state.connectors.push(item);
      return HttpResponse.json(connectorOut(item, locale), { status: 201 });
    }),

    authed("get", "/connectors/:id", ({ user, params, locale }) => {
      if (!can(user.roles, "connector.view")) return deny();
      const item = findConnector(user, params.id!);
      return item ? HttpResponse.json(connectorOut(item, locale)) : problem(404, "Not found");
    }),

    authed("put", "/connectors/:id", async ({ user, params, request, locale }) => {
      if (!can(user.roles, "connector.manage")) return deny();
      const item = findConnector(user, params.id!);
      if (!item) return problem(404, "Not found");
      const body = (await request.json().catch(() => null)) as Partial<ConnectorInput> | null;
      const errors = connectorErrors(body ?? {}, user);
      if (errors.length) return invalid(errors);
      const input = body as ConnectorInput;
      Object.assign(item, {
        name: input.name.trim(),
        org: input.org,
        type: input.type,
        endpoint: input.endpoint.trim(),
        auth: input.auth,
        schedule: input.schedule.trim(),
        enabled: Boolean(input.enabled),
        sourceFields: input.mapping.map((entry) => entry.source),
        mapping: input.mapping,
      });
      return HttpResponse.json(connectorOut(item, locale));
    }),

    /** First 50 mapped rows, with an optional unsaved mapping (brief §7 "Dry run"). */
    authed("post", "/connectors/:id/dry-run", async ({ user, params, request }) => {
      if (!can(user.roles, "connector.view")) return deny();
      const item = findConnector(user, params.id!);
      if (!item) return problem(404, "Not found");
      const body = (await request.json().catch(() => null)) as {
        mapping?: ConnectorMapping[];
      } | null;
      const mapping = Array.isArray(body?.mapping) ? body.mapping : item.mapping;
      const errors = mappingErrors(mapping, targetsFor(item.org));
      if (errors.length) return typed(422, "mapping", "Mapping incomplete");
      if (broken(item.endpoint)) return typed(502, "unreachable", "HTTP 503 Service Unavailable");
      const rows = sourceRows(item.org, mapping);
      const body2: ConnectorDryRun = {
        total: rows.length,
        rows: rows.slice(0, DRY_RUN_ROWS),
        issues: issueCount(rows),
      };
      return HttpResponse.json(body2);
    }),

    /** Runs now: fetches, maps and submits the rows for verification. */
    authed("post", "/connectors/:id/run", ({ user, params, locale }) => {
      if (!can(user.roles, "connector.manage")) return deny();
      const item = findConnector(user, params.id!);
      if (!item) return problem(404, "Not found");
      const started = new Date();
      const at = (seconds: number) => new Date(started.getTime() + seconds * 1000).toISOString();
      const id = `RUN-${item.id.slice(4)}-${item.runs.length + 1}`;
      if (broken(item.endpoint)) {
        const run: StoredRun = {
          id,
          started: started.toISOString(),
          finished: at(20),
          status: "failed",
          trigger: "manual",
          by: user.id,
          rows: 0,
          error: "HTTP 503 Service Unavailable",
          log: [
            {
              time: at(0),
              level: "info",
              message: { fr: "Connexion à la source", en: "Connecting to the source" },
            },
            {
              time: at(10),
              level: "warn",
              message: { fr: "Nouvelle tentative (1/3)", en: "Retrying (1/3)" },
            },
            {
              time: at(20),
              level: "error",
              message: { fr: "HTTP 503 Service Unavailable", en: "HTTP 503 Service Unavailable" },
            },
          ],
        };
        record(item, run);
        return HttpResponse.json(runOut(run, locale), { status: 201 });
      }
      const rows = sourceRows(item.org, item.mapping);
      const submissionId = rows.length ? nextSubmissionId() : undefined;
      if (submissionId) {
        const now = started.toISOString();
        const submission: StoredSubmission = {
          id: submissionId,
          org: item.org,
          indicators: [...new Set(rows.map((row) => row.indicator))],
          period: rows
            .map((row) => row.period)
            .sort()
            .at(-1)!,
          channel: "connector",
          status: "submitted",
          submittedBy: user.id,
          updated: now,
          rows: rows.map((row, index) => {
            const published =
              deps
                .series(row.indicator, row.area, row.dims)
                .find((item) => item.period === row.period)?.value ?? null;
            return {
              id: `${submissionId}-${index + 1}`,
              indicator: row.indicator,
              area: row.area,
              period: row.period,
              dims: row.dims,
              value: row.value,
              unit: unitOf.get(row.indicator) ?? "",
              status: row.flag ?? "P",
              published,
            };
          }),
          justifications: {},
          history: [
            { id: `${submissionId}-h0`, date: now, to: "draft", actor: user.id },
            {
              id: `${submissionId}-h1`,
              date: now,
              from: "draft",
              to: "submitted",
              actor: user.id,
              comment: `${item.name} (${id})`,
            },
          ],
        };
        state.submissions.push(submission);
      }
      const run: StoredRun = {
        id,
        started: started.toISOString(),
        finished: at(8),
        status: "ok",
        trigger: "manual",
        by: user.id,
        rows: rows.length,
        ...(submissionId ? { submission: submissionId } : {}),
        log: [
          {
            time: at(0),
            level: "info",
            message: { fr: "Connexion à la source", en: "Connecting to the source" },
          },
          {
            time: at(4),
            level: "info",
            message: {
              fr: `${rows.length} enregistrements reçus`,
              en: `${rows.length} records received`,
            },
          },
          submissionId
            ? {
                time: at(8),
                level: "info",
                message: {
                  fr: `Soumission ${submissionId} créée`,
                  en: `Submission ${submissionId} created`,
                },
              }
            : {
                time: at(8),
                level: "info",
                message: { fr: "Aucune nouvelle valeur", en: "No new values" },
              },
        ],
      };
      record(item, run);
      return HttpResponse.json(runOut(run, locale), { status: 201 });
    }),
  ];

  // ---- Quality ----

  const qualityHandlers = [
    authed("get", "/quality", ({ user, q, locale }) => {
      const orgs = scope(user, q);
      const inScope = state.submissions.filter((item) => orgs.includes(item.org));
      const { rated, warnings } = qualityStats(inScope, deps.previous);
      const cutoff = new Date(Date.now() - 30 * DAY).toISOString();
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + index, 1));
        return date.toISOString().slice(0, 7);
      });
      const group = <K extends string>(key: (item: (typeof rated)[number]) => K) => {
        const groups = new Map<K, typeof rated>();
        for (const item of rated) {
          const k = key(item);
          groups.set(k, [...(groups.get(k) ?? []), item]);
        }
        return groups;
      };
      const byOrg = group((item) => item.submission.org);
      const byIndicator = group((item) => item.row.indicator);
      const byMonth = group((item) => item.submission.updated.slice(0, 7));
      const all = rate(rated);
      const before = rate(rated.filter((item) => item.submission.updated < cutoff));
      const body: QualityOverview = {
        passRate: all.passRate ?? 1,
        previous: before.passRate ?? all.passRate ?? 1,
        checked: all.checked,
        byOrg: [...byOrg]
          .map(([org, items]) => ({ org, name: orgName(org, locale), ...rate(items) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        byIndicator: [...byIndicator]
          .map(([code, items]) => ({
            code,
            name: localise<string>(deps.names.indicator(code), locale),
            ...rate(items),
          }))
          .sort((a, b) => (a.passRate ?? 1) - (b.passRate ?? 1) || a.code.localeCompare(b.code)),
        byMonth: months.map((month) => ({ month, ...rate(byMonth.get(month) ?? []) })),
        warnings: warnings
          .map(({ submission, row, rule }): QualityWarning => ({
            submission: submission.id,
            status: submission.status,
            org: submission.org,
            orgName: orgName(submission.org, locale),
            indicator: row.indicator,
            indicatorName: localise<string>(deps.names.indicator(row.indicator), locale),
            area: row.area,
            areaName: localise<string>(deps.names.area(row.area), locale),
            period: row.period,
            rule: rule as QualityWarning["rule"],
            value: row.value,
            updated: submission.updated,
          }))
          .sort(
            (a, b) =>
              b.updated.localeCompare(a.updated) || a.submission.localeCompare(b.submission),
          ),
      };
      return HttpResponse.json(body);
    }),
  ];

  // ---- Indicator referential ----

  const pillarOf = (code: string) => deps.pillars.find((item) => item.code === code);
  const priorityOf = (item: IndicatorRecord) => {
    const { availability, quality, strategic, comparability } = item.priority;
    return Math.round(((availability + quality + strategic + comparability) / 4) * 10) / 10;
  };
  const adminOut = (item: StoredIndicator): IndicatorAdmin => ({
    ...structuredClone({ ...item, versions: undefined }),
    versions: item.versions.map((version) => ({
      ...version,
      changes: [...version.changes],
      author: { id: version.author, name: userName(version.author) },
    })),
  });

  const recordErrors = (input: IndicatorRecord): FieldError[] => {
    const errors: FieldError[] = [];
    const add = (path: string, message: string) => errors.push({ path, message });
    const isText = (value: unknown) =>
      Boolean(value) &&
      typeof value === "object" &&
      Object.values(value as object).every((v) => typeof v === "string");
    for (const key of [
      "name",
      "shortDefinition",
      "definition",
      "computation",
      "qualityNotes",
      "unit",
    ] as const) {
      if (!isText(input[key])) add(key, "format");
    }
    if (errors.length) return errors;
    if (!input.name[deps.defaultLocale]?.trim()) add(`name.${deps.defaultLocale}`, "required");
    if (!input.shortDefinition[deps.defaultLocale]?.trim())
      add(`shortDefinition.${deps.defaultLocale}`, "required");
    if (!input.unit[deps.defaultLocale]?.trim()) add(`unit.${deps.defaultLocale}`, "required");
    if (!STATUSES.includes(input.status)) add("status", "unknown");
    const pillar = pillarOf(input.pillar);
    if (!pillar) add("pillar", "unknown");
    else if (!pillar.themes.some((theme) => theme.code === input.theme)) add("theme", "unknown");
    if (!state.orgs.some((org) => org.code === input.org)) add("org", "unknown");
    if (!PERIODICITIES.includes(input.periodicity)) add("periodicity", "unknown");
    if (!Array.isArray(input.unitVariants) || input.unitVariants.length === 0)
      add("unitVariants", "required");
    const codes = new Set<string>();
    (input.unitVariants ?? []).forEach((variant, index) => {
      if (!variant.code?.trim()) add(`unitVariants.${index}.code`, "required");
      else if (codes.has(variant.code)) add(`unitVariants.${index}.code`, "duplicate");
      codes.add(variant.code);
      if (!variant.label?.[deps.defaultLocale]?.trim())
        add(`unitVariants.${index}.label.${deps.defaultLocale}`, "required");
    });
    for (const dim of input.disaggregations ?? []) {
      if (!DIMENSIONS.includes(dim)) add("disaggregations", "unknown");
    }
    if (!input.geoLevels?.length) add("geoLevels", "required");
    for (const level of input.geoLevels ?? []) {
      if (!deps.geoLevels.includes(level)) add("geoLevels", "unknown");
    }
    const number = (value: unknown) =>
      value === null || (typeof value === "number" && Number.isFinite(value));
    const { thresholds, goalposts } = input;
    if (!number(thresholds?.min)) add("thresholds.min", "format");
    if (!number(thresholds?.max)) add("thresholds.max", "format");
    if (thresholds?.min !== null && thresholds?.max !== null && thresholds.min >= thresholds.max) {
      add("thresholds.max", "order");
    }
    if (!(
      typeof thresholds?.jumpPct === "number" &&
      thresholds.jumpPct >= 1 &&
      thresholds.jumpPct <= 1000
    )) {
      add("thresholds.jumpPct", "range");
    }
    if (!number(goalposts?.min)) add("goalposts.min", "format");
    if (!number(goalposts?.max)) add("goalposts.max", "format");
    if (!number(goalposts?.target)) add("goalposts.target", "format");
    if (goalposts?.min !== null && goalposts?.max !== null && goalposts.min >= goalposts.max) {
      add("goalposts.max", "order");
    }
    if (goalposts?.targetYear !== null && !/^\d{4}$/.test(goalposts?.targetYear ?? "")) {
      add("goalposts.targetYear", "format");
    }
    if (goalposts?.target !== null && goalposts?.targetYear === null)
      add("goalposts.targetYear", "required");
    (input.intlRefs ?? []).forEach((ref, index) => {
      if (!INTL_ORGS.includes(ref.org)) add(`intlRefs.${index}.org`, "unknown");
      if (!ref.code?.trim()) add(`intlRefs.${index}.code`, "required");
      if (!/^https?:\/\/\S+$/.test(ref.url ?? "")) add(`intlRefs.${index}.url`, "format");
    });
    if (input.nextRelease !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.nextRelease ?? "")) {
      add("nextRelease", "format");
    }
    for (const key of ["availability", "quality", "strategic", "comparability"] as const) {
      const value = input.priority?.[key];
      if (!(Number.isInteger(value) && value >= 1 && value <= 5)) add(`priority.${key}`, "range");
    }
    if (!/^.{1,80}$/.test(input.licence ?? "")) add("licence", "required");
    return errors;
  };

  /** Keeps only the fields of a record, trimmed, so stray keys never reach the store. */
  const clean = (input: IndicatorRecord, code: string): IndicatorRecord => {
    const text = (value: Text) =>
      Object.fromEntries(
        deps.locales.map((locale) => [locale, (value[locale] ?? "").trim()]).filter(([, v]) => v),
      );
    return {
      code,
      status: input.status,
      pillar: input.pillar,
      theme: input.theme,
      org: input.org,
      name: text(input.name),
      shortDefinition: text(input.shortDefinition),
      definition: text(input.definition),
      computation: text(input.computation),
      qualityNotes: text(input.qualityNotes),
      synonyms: [...new Set((input.synonyms ?? []).map((item) => item.trim()).filter(Boolean))],
      licence: input.licence.trim(),
      unit: text(input.unit),
      unitVariants: input.unitVariants.map((variant) => ({
        code: variant.code.trim(),
        label: text(variant.label),
      })),
      higherIsBetter: Boolean(input.higherIsBetter),
      isHeadline: Boolean(input.isHeadline),
      disaggregations: DIMENSIONS.filter((dim) => input.disaggregations.includes(dim)),
      geoLevels: deps.geoLevels.filter((level) => input.geoLevels.includes(level)),
      thresholds: { ...input.thresholds },
      goalposts: { ...input.goalposts },
      intlRefs: input.intlRefs.map((ref) => ({
        org: ref.org,
        code: ref.code.trim(),
        name: text(ref.name ?? {}),
        url: ref.url.trim(),
      })),
      periodicity: input.periodicity,
      nextRelease: input.nextRelease,
      priority: { ...input.priority },
    };
  };

  const indicatorHandlers = [
    authed("get", "/indicators", ({ user, q, locale }) => {
      if (!can(user.roles, "indicator.view")) return deny();
      const text = q.get("q")?.trim().toLowerCase();
      const status = STATUSES.find((item) => item === q.get("status"));
      const pillar = q.get("pillar");
      const rows = state.indicators
        .map((item): IndicatorAdminSummary => ({
          code: item.code,
          name: localise<string>(item.name, locale),
          pillar: item.pillar,
          pillarName: localise<string>(pillarOf(item.pillar)?.name ?? item.pillar, locale),
          status: item.status,
          priority: priorityOf(item),
          periodicity: item.periodicity,
          org: item.org,
          orgName: orgName(item.org, locale),
          version: item.version,
          updated: item.updated,
        }))
        .filter((item) => !status || item.status === status)
        .filter((item) => !pillar || item.pillar === pillar)
        .filter(
          (item) =>
            !text ||
            item.code.toLowerCase().includes(text) ||
            item.name.toLowerCase().includes(text),
        )
        .sort((a, b) =>
          q.get("sort") === "priority"
            ? b.priority - a.priority || a.code.localeCompare(b.code)
            : a.code.localeCompare(b.code),
        );
      const requested = Number(q.get("pageSize"));
      const pageSize = PAGE_SIZES.includes(requested) ? requested : DEFAULT_PAGE_SIZE;
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      const page = Math.min(Math.max(1, Number(q.get("page")) || 1), pages);
      const body: Page<IndicatorAdminSummary> = {
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        meta: { page, pageSize, total: rows.length },
      };
      return HttpResponse.json(body);
    }),

    authed("post", "/indicators", async ({ user, request }) => {
      if (!can(user.roles, "indicator.edit")) return deny();
      const body = (await request.json().catch(() => null)) as Partial<IndicatorCreateInput> | null;
      const code = body?.code?.trim().toUpperCase() ?? "";
      const errors: FieldError[] = [];
      if (!CODE.test(code)) errors.push({ path: "code", message: "format" });
      else if (state.indicators.some((item) => item.code === code)) {
        errors.push({ path: "code", message: "duplicate" });
      }
      if (!body?.name?.[deps.defaultLocale]?.trim()) {
        errors.push({ path: `name.${deps.defaultLocale}`, message: "required" });
      }
      const pillar = pillarOf(body?.pillar ?? "");
      if (!pillar) errors.push({ path: "pillar", message: "required" });
      else if (!pillar.themes.some((theme) => theme.code === body?.theme)) {
        errors.push({ path: "theme", message: "required" });
      }
      if (!state.orgs.some((org) => org.code === body?.org))
        errors.push({ path: "org", message: "required" });
      if (errors.length) return invalid(errors);
      const now = new Date().toISOString();
      const name = Object.fromEntries(
        deps.locales
          .map((locale) => [locale, body!.name![locale]?.trim() ?? ""])
          .filter(([, v]) => v),
      );
      const item: StoredIndicator = {
        code,
        status: "planned",
        pillar: body!.pillar!,
        theme: body!.theme!,
        org: body!.org!,
        name,
        shortDefinition: { ...name },
        definition: {},
        computation: {},
        qualityNotes: {},
        synonyms: [],
        licence: "CC BY 4.0",
        unit: { [deps.defaultLocale]: "%" },
        unitVariants: [{ code: "pct", label: { [deps.defaultLocale]: "%" } }],
        higherIsBetter: true,
        isHeadline: false,
        disaggregations: [],
        geoLevels: ["national"],
        thresholds: { min: null, max: null, jumpPct: 30 },
        goalposts: { min: null, max: null, target: null, targetYear: null },
        intlRefs: [],
        periodicity: "annual",
        nextRelease: null,
        priority: { availability: 3, quality: 3, strategic: 3, comparability: 3 },
        version: 1,
        updated: now,
        versions: [{ version: 1, date: now, note: "", author: user.id, changes: [] }],
      };
      state.indicators.push(item);
      deps.syncIndicator(item);
      return HttpResponse.json(adminOut(item), { status: 201 });
    }),

    authed("get", "/indicators/:code", ({ user, params }) => {
      if (!can(user.roles, "indicator.view")) return deny();
      const item = state.indicators.find((entry) => entry.code === params.code);
      return item ? HttpResponse.json(adminOut(item)) : problem(404, "Not found");
    }),

    /** Saves a new version (brief §7: "save creates a new version with a note"). */
    authed("put", "/indicators/:code", async ({ user, params, request }) => {
      if (!can(user.roles, "indicator.edit")) return deny();
      const item = state.indicators.find((entry) => entry.code === params.code);
      if (!item) return problem(404, "Not found");
      const body = (await request.json().catch(() => null)) as {
        indicator?: IndicatorRecord;
        note?: string;
      } | null;
      if (!body?.indicator || typeof body.indicator !== "object")
        return invalid([{ path: "indicator", message: "required" }]);
      const errors = recordErrors(body.indicator);
      const note = body.note?.trim() ?? "";
      if (!note) errors.push({ path: "note", message: "required" });
      if (errors.length) return invalid(errors);
      const next = clean(body.indicator, item.code);
      const changes = (Object.keys(next) as (keyof IndicatorRecord)[]).filter(
        (key) => key !== "code" && JSON.stringify(next[key]) !== JSON.stringify(item[key]),
      );
      if (!changes.length) return typed(422, "unchanged", "Nothing changed");
      const now = new Date().toISOString();
      const version = item.version + 1;
      Object.assign(item, next, { version, updated: now });
      item.versions.unshift({
        version,
        date: now,
        note: note.slice(0, 500),
        author: user.id,
        changes,
      });
      deps.syncIndicator(item);
      return HttpResponse.json(adminOut(item));
    }),
  ];

  return [...connectorHandlers, ...qualityHandlers, ...indicatorHandlers];
}
