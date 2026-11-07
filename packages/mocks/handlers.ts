import type {
  Area,
  ExportJob,
  Indicator,
  LatestValue,
  Observation,
  PeerRow,
  PeerStats,
  Problem,
  RankHistoryRow,
  Series,
} from "@onn/api-client/types";
import { http, HttpResponse, type RequestHandler } from "msw";
import type { Fixtures } from "./fixtures";

const SPARK_POINTS = 10;
const POLLS_UNTIL_DONE = 2;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 500;

export interface HandlerOptions {
  /** [min, max] in ms. Brief §3 asks for 150–600 ms. */
  latency?: [number, number];
}

function problem(status: number, title: string, detail?: string, errors?: Problem["errors"]) {
  const body: Problem = { type: "about:blank", title, status, detail, errors };
  return HttpResponse.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

/** Turns stored `{fr, en}` text into one language and flags anything that fell back. */
function createLocaliser(locales: string[], defaultLocale: string) {
  const isText = (value: object): value is Record<string, string> => {
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((key) => locales.includes(key));
  };
  return function localise<T>(value: unknown, locale: string): T {
    let fallback = false;
    const walk = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(walk);
      if (node === null || typeof node !== "object") return node;
      if (isText(node)) {
        if (node[locale] !== undefined) return node[locale];
        fallback = true;
        return node[defaultLocale];
      }
      return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, walk(item)]));
    };
    const result = walk(value);
    if (fallback && result && typeof result === "object" && !Array.isArray(result)) {
      return { ...result, fallback: true } as T;
    }
    return result as T;
  };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  return Math.round((value ?? 0) * 10) / 10;
}

const list = (value: string | null) => (value ? value.split(",").filter(Boolean) : []);

function parseYears(value: string | null) {
  if (!value) return () => true;
  const [from, to = from] = value.split("-");
  return (period: string) => {
    const year = period.slice(0, 4);
    return year >= (from as string) && year <= (to as string);
  };
}

/** No dims means the total; `key:*` matches every value of that key. */
function matchDims(wanted: string | null) {
  const pairs = list(wanted).map((pair) => pair.split(":") as [string, string]);
  return (dims: Record<string, string>) => {
    const keys = Object.keys(dims);
    if (keys.length !== pairs.length) return false;
    return pairs.every(
      ([key, value]) => dims[key] !== undefined && (value === "*" || dims[key] === value),
    );
  };
}

function paginate<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const requested = Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(requested, MAX_PAGE_SIZE);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    meta: { total: items.length, page, pageSize },
  };
}

function toCsv(rows: Observation[]) {
  const header = "indicator,area,period,dims,value,unit,status,source";
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = rows.map((row) =>
    [
      row.indicator,
      row.area,
      row.period,
      Object.entries(row.dims)
        .map(([key, value]) => `${key}:${value}`)
        .join(";"),
      row.value,
      row.unit,
      row.status,
      row.source,
    ]
      .map(cell)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

interface RouteContext {
  url: URL;
  q: URLSearchParams;
  locale: string;
  params: Record<string, string>;
  request: Request;
}
type Resolver = (ctx: RouteContext) => Response | Promise<Response>;

export function createHandlers(data: Fixtures, options: HandlerOptions = {}): RequestHandler[] {
  const { locales, defaultLocale, iso3 } = data.meta;
  const [minLatency, maxLatency] = options.latency ?? [150, 600];
  const localise = createLocaliser(locales, defaultLocale);
  const exportJobs = new Map<string, number>();

  const byIndicatorArea = new Map<string, Observation[]>();
  for (const row of data.observations) {
    const key = `${row.indicator}|${row.area}`;
    const rows = byIndicatorArea.get(key);
    if (rows) rows.push(row);
    else byIndicatorArea.set(key, [row]);
  }

  const indicatorSeed = (code: string) => data.indicators.find((item) => item.code === code);
  const getIndicator = (code: string, locale: string) => {
    const seed = indicatorSeed(code);
    return seed ? localise<Indicator>(seed, locale) : undefined;
  };

  /** Overlays the requested language and applies a unit variant. */
  const present = (row: Observation, locale: string, unit: string | null): Observation => {
    const indicator = getIndicator(row.indicator, locale);
    const factor = (unit && data.unitFactors[row.indicator]?.[unit]) || 1;
    const variant = indicator?.unitVariants.find((item) => item.code === unit);
    return {
      ...row,
      value: row.value === null ? null : Math.round(row.value * factor * 10) / 10,
      unit: variant?.label ?? indicator?.unit ?? row.unit,
      source: indicator?.source.org ?? row.source,
    };
  };

  const areaCodesAt = (level: string) =>
    data.areas.filter((area) => area.level === level).map((area) => area.code);

  const latestOf = (rows: Observation[]) =>
    [...rows].reverse().find((row) => row.value !== null && Object.keys(row.dims).length === 0);

  const latestValue = (code: string, area: string): LatestValue | undefined => {
    const totals = (byIndicatorArea.get(`${code}|${area}`) ?? []).filter(
      (row) => Object.keys(row.dims).length === 0,
    );
    const latest = latestOf(totals);
    if (latest?.value == null) return undefined;
    const index = totals.indexOf(latest);
    const previous = totals
      .slice(0, index)
      .reverse()
      .find((row) => row.value !== null);
    const changePct = previous?.value
      ? Math.round(((latest.value - previous.value) / previous.value) * 1000) / 10
      : undefined;
    return {
      value: latest.value,
      year: latest.period,
      changePct,
      status: latest.status,
      sparkline: totals.slice(Math.max(0, index + 1 - SPARK_POINTS), index + 1).map((r) => r.value),
    };
  };

  const peerRows = (code: string, group: string, locale: string, year?: string) => {
    const members = data.peers.members[group] ?? [];
    const values = data.peers.values[code] ?? {};
    const years = Object.keys(values[iso3] ?? Object.values(values)[0] ?? {}).sort();
    const usable = (y: string) => members.filter((iso) => values[iso]?.[y] != null);
    const commonYear =
      year ?? [...years].reverse().find((y) => usable(y).length === members.length) ?? years.at(-1);
    const rowsFor = (y: string): PeerRow[] => {
      const direction = indicatorSeed(code)?.higherIsBetter === false ? 1 : -1;
      const ranked = members
        .map((iso) => ({ iso, value: values[iso]?.[y] ?? null }))
        .sort((a, b) => {
          if (a.value === null) return 1;
          if (b.value === null) return -1;
          return (a.value - b.value) * direction;
        });
      return ranked.map(({ iso, value }, i) => ({
        area: iso,
        name: localise<string>(data.peers.economies[iso], locale),
        value,
        year: y,
        rank: i + 1,
      }));
    };
    return { years, rows: commonYear ? rowsFor(commonYear) : [], rowsFor, usable, values };
  };

  const route = (method: "get" | "post", path: string, resolver: Resolver) =>
    http[method](`*/api/v1${path}`, async ({ request, params }) => {
      if (maxLatency > 0) {
        const wait = minLatency + Math.random() * (maxLatency - minLatency);
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      const url = new URL(request.url);
      if (url.searchParams.get("_fail") === "1") {
        return problem(500, "Forced failure", "Requested with ?_fail=1");
      }
      const header = request.headers.get("Accept-Language")?.split(/[,;-]/)[0]?.trim() ?? "";
      const locale = locales.includes(header) ? header : defaultLocale;
      return resolver({
        url,
        q: url.searchParams,
        locale,
        params: params as Record<string, string>,
        request,
      });
    });

  const notFound = (what: string) => problem(404, "Not found", `${what} does not exist`);

  const findBySlug = <T extends { slug?: unknown }>(items: T[], slug: string) =>
    items.find((item) => item.slug === slug);

  return [
    route("get", "/pillars", ({ locale }) => {
      const pillars = data.pillars.map((pillar) => {
        const inPillar = data.indicators.filter((item) => item.pillar === pillar.code);
        return {
          ...localise<Record<string, unknown>>(pillar, locale),
          indicatorCount: inPillar.length,
          themes: pillar.themes.map((theme) => ({
            code: theme.code,
            name: localise<string>(theme.name, locale),
            indicatorCount: inPillar.filter((item) => item.theme === theme.code).length,
          })),
        };
      });
      return HttpResponse.json(pillars);
    }),

    route("get", "/indicators", ({ url, q, locale }) => {
      const search = q.get("q")?.toLowerCase();
      const area = q.get("area") ?? iso3;
      const filtered = data.indicators.filter((seed) => {
        const text = JSON.stringify([seed.code, seed.name, seed.synonyms]).toLowerCase();
        const isSubnational = seed.geoLevels.length > 1;
        if (search && !text.includes(search)) return false;
        if (q.get("pillar") && seed.pillar !== q.get("pillar")) return false;
        if (q.get("theme") && seed.theme !== q.get("theme")) return false;
        if (q.get("geo_level") && !seed.geoLevels.includes(q.get("geo_level") as string))
          return false;
        if (q.get("headline") === "true" && !seed.isHeadline) return false;
        if (q.get("source") && seed.source.method !== q.get("source")) return false;
        if (q.get("periodicity") && seed.periodicity !== q.get("periodicity")) return false;
        if (q.get("status") && seed.status !== q.get("status")) return false;
        if (q.get("subnational") === "true" && !isSubnational) return false;
        if (q.get("subnational") === "false" && isSubnational) return false;
        return true;
      });
      const page = paginate(filtered, url);
      return HttpResponse.json({
        ...page,
        items: page.items.map((seed) => ({
          ...localise<Record<string, unknown>>(seed, locale),
          latest: latestValue(seed.code as string, area),
        })),
      });
    }),

    route("get", "/indicators/:code", ({ params, locale }) => {
      const indicator = getIndicator(params.code as string, locale);
      if (!indicator) return notFound(`Indicator ${params.code}`);
      return HttpResponse.json({ ...indicator, latest: latestValue(indicator.code, iso3) });
    }),

    route("get", "/areas", ({ q, locale }) => {
      const areas = data.areas.filter(
        (area) =>
          (!q.get("level") || area.level === q.get("level")) &&
          (!q.get("parent") || area.parent === q.get("parent")),
      );
      return HttpResponse.json(localise<Area[]>(areas, locale));
    }),

    route("get", "/areas/:code/geometry", ({ q }) => {
      const level = q.get("level") ?? "adm1";
      const topology = data.geo[level];
      return topology ? HttpResponse.json(topology as never) : notFound(`Geometry level ${level}`);
    }),

    route("get", "/series", ({ q, locale }) => {
      const years = parseYears(q.get("years"));
      const dimsMatch = matchDims(q.get("dims"));
      const unit = q.get("unit");
      const series: Series[] = [];
      for (const code of list(q.get("indicator"))) {
        for (const area of list(q.get("area"))) {
          if (area.startsWith("peer:")) {
            const group = area.slice("peer:".length);
            const { years: peerYears, usable, values } = peerRows(code, group, locale);
            series.push({
              indicator: code,
              area,
              dims: {},
              unit: getIndicator(code, locale)?.unit ?? "",
              points: peerYears.filter(years).map((period) => ({
                period,
                value: median(usable(period).map((iso) => values[iso]?.[period] as number)),
                status: "A",
              })),
            });
            continue;
          }
          const peer = data.peers.values[code]?.[area];
          if (peer && area !== iso3) {
            series.push({
              indicator: code,
              area,
              dims: {},
              unit: getIndicator(code, locale)?.unit ?? "",
              points: Object.keys(peer)
                .filter(years)
                .map((period) => {
                  const value = peer[period] ?? null;
                  return { period, value, status: value === null ? "M" : "A" };
                }),
            });
            continue;
          }
          const groups = new Map<string, Series>();
          for (const raw of byIndicatorArea.get(`${code}|${area}`) ?? []) {
            if (!years(raw.period) || !dimsMatch(raw.dims)) continue;
            const row = present(raw, locale, unit);
            const key = JSON.stringify(row.dims);
            const entry = groups.get(key) ?? {
              indicator: code,
              area,
              dims: row.dims,
              unit: row.unit,
              points: [],
            };
            entry.points.push({ period: row.period, value: row.value, status: row.status });
            groups.set(key, entry);
          }
          series.push(...groups.values());
        }
      }
      return HttpResponse.json(series);
    }),

    route("get", "/data", ({ url, q, locale }) => {
      const format = q.get("format") ?? "json";
      if (format === "xlsx") {
        return problem(501, "Not implemented", "The mock server does not produce XLSX files");
      }
      const level = q.get("level");
      const areas = level ? areaCodesAt(level) : list(q.get("area"));
      const years = parseYears(q.get("year"));
      const dimsMatch = matchDims(q.get("dims"));
      const unit = q.get("unit");
      const rows: Observation[] = [];
      for (const code of list(q.get("indicator"))) {
        for (const area of areas.length ? areas : [iso3]) {
          for (const raw of byIndicatorArea.get(`${code}|${area}`) ?? []) {
            if (years(raw.period) && dimsMatch(raw.dims)) rows.push(present(raw, locale, unit));
          }
        }
      }
      if (format === "csv" || format === "sdmx-csv") {
        return new HttpResponse(toCsv(rows), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="onn-data.csv"`,
          },
        });
      }
      return HttpResponse.json(paginate(rows, url));
    }),

    route("get", "/data/latest", ({ q, locale }) => {
      const level = q.get("level");
      const areas = level ? areaCodesAt(level) : list(q.get("area"));
      const rows = list(q.get("indicator")).flatMap((code) =>
        (areas.length ? areas : [iso3]).flatMap((area) => {
          const latest = latestOf(byIndicatorArea.get(`${code}|${area}`) ?? []);
          return latest ? [present(latest, locale, q.get("unit"))] : [];
        }),
      );
      return HttpResponse.json(rows);
    }),

    route("get", "/benchmark", ({ q, locale }) => {
      const code = q.get("indicator") ?? "";
      const group = q.get("group") ?? data.meta.defaultPeerGroup;
      if (!data.peers.values[code]) return notFound(`Peer data for ${code}`);
      if (!data.peers.members[group]) return notFound(`Peer group ${group}`);
      const { rows, years, rowsFor, usable, values } = peerRows(
        code,
        group,
        locale,
        q.get("year") ?? undefined,
      );
      const stats: PeerStats[] = years.flatMap((year) => {
        const present = usable(year).map((iso) => values[iso]?.[year] as number);
        if (!present.length) return [];
        return [
          { year, median: median(present), min: Math.min(...present), max: Math.max(...present) },
        ];
      });
      const history: RankHistoryRow[] = years
        .slice(-5)
        .flatMap((year) =>
          rowsFor(year).map(({ area, name, rank }) => ({ area, name, year, rank })),
        );
      return HttpResponse.json({ rows, stats, history, retrievedAt: data.peers.retrievedAt });
    }),

    route("get", "/index", ({ q, locale }) => {
      const year = q.get("year");
      const entry = year ? data.index.find((item) => item.year === year) : data.index.at(-1);
      return entry
        ? HttpResponse.json(localise<Record<string, never>>(entry, locale))
        : notFound(`Index for ${year}`);
    }),

    route("get", "/targets", ({ locale }) =>
      HttpResponse.json(localise<Record<string, never>>(data.targets, locale)),
    ),

    route("get", "/dashboards", ({ locale }) =>
      HttpResponse.json(
        data.dashboards.map((item) => localise<Record<string, never>>(item, locale)),
      ),
    ),

    route("get", "/dashboards/:slug", ({ params, locale }) => {
      const item = findBySlug(data.dashboards, params.slug as string);
      return item
        ? HttpResponse.json(localise<Record<string, never>>(item, locale))
        : notFound(`Dashboard ${params.slug}`);
    }),

    route("get", "/publications", ({ url, q, locale }) => {
      const items = data.publications
        .filter(
          (item) =>
            (!q.get("type") || item.type === q.get("type")) &&
            (!q.get("pillar") || item.pillar === q.get("pillar")) &&
            (!q.get("year") || String(item.date).startsWith(q.get("year") as string)),
        )
        .map((item) => localise<Record<string, unknown>>(item, locale));
      return HttpResponse.json(paginate(items, url) as never);
    }),

    route("get", "/publications/:slug", ({ params, locale }) => {
      const item = findBySlug(data.publications, params.slug as string);
      return item
        ? HttpResponse.json(localise<Record<string, never>>(item, locale))
        : notFound(`Publication ${params.slug}`);
    }),

    route(
      "get",
      "/publications/:slug/cover.svg",
      () =>
        new HttpResponse(
          `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#DDE2E8"/></svg>`,
          { headers: { "Content-Type": "image/svg+xml" } },
        ),
    ),

    route(
      "get",
      "/publications/:slug/file.pdf",
      () =>
        new HttpResponse("%PDF-1.4\n%%EOF\n", { headers: { "Content-Type": "application/pdf" } }),
    ),

    route("get", "/news", ({ url, q, locale }) => {
      const items = data.news
        .filter(
          (item) =>
            (!q.get("kind") || item.kind === q.get("kind")) &&
            (!q.get("tag") || item.tags.includes(q.get("tag") as string)),
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)))
        .map((item) => localise<Record<string, unknown>>(item, locale));
      return HttpResponse.json(paginate(items, url) as never);
    }),

    route("get", "/news/:slug", ({ params, locale }) => {
      const item = findBySlug(data.news, params.slug as string);
      return item
        ? HttpResponse.json(localise<Record<string, never>>(item, locale))
        : notFound(`News item ${params.slug}`);
    }),

    route("get", "/home", ({ locale }) =>
      HttpResponse.json(localise<Record<string, never>>(data.home, locale)),
    ),

    route("get", "/pages/:slug", ({ params, locale }) => {
      const item = findBySlug(data.pages, params.slug as string);
      return item
        ? HttpResponse.json(localise<Record<string, never>>(item, locale))
        : notFound(`Page ${params.slug}`);
    }),

    route("get", "/datasets", ({ locale }) =>
      HttpResponse.json(data.datasets.map((item) => localise<Record<string, never>>(item, locale))),
    ),

    route("post", "/feedback", () => HttpResponse.json({ ok: true }, { status: 201 })),

    route("post", "/subscribers", async ({ request }) => {
      const body = (await request.json().catch(() => null)) as { email?: string } | null;
      if (!body?.email?.includes("@")) {
        return problem(422, "Invalid input", undefined, [
          { path: "email", message: "Enter a valid email address" },
        ]);
      }
      return HttpResponse.json({ ok: true }, { status: 201 });
    }),

    route("post", "/api-keys", () => HttpResponse.json({ ok: true }, { status: 201 })),

    route("post", "/exports", () => {
      const jobId = String(exportJobs.size + 1);
      exportJobs.set(jobId, 0);
      return HttpResponse.json({ jobId }, { status: 202 });
    }),

    route("get", "/exports/:jobId", ({ params }) => {
      const jobId = params.jobId as string;
      const polls = exportJobs.get(jobId);
      if (polls === undefined) return notFound(`Export job ${jobId}`);
      exportJobs.set(jobId, polls + 1);
      const job: ExportJob =
        polls + 1 >= POLLS_UNTIL_DONE
          ? { status: "done", url: `/api/v1/exports/${jobId}/file` }
          : { status: "running" };
      return HttpResponse.json(job);
    }),

    route(
      "get",
      "/exports/:jobId/file",
      () =>
        new HttpResponse("%PDF-1.4\n%%EOF\n", { headers: { "Content-Type": "application/pdf" } }),
    ),
  ];
}
