// OpenAPI 3.1 description of the public API the portal uses (brief §3), served by the mock at
// /api/v1/openapi.json for the developers page. It mirrors packages/api-client/types.ts; keep the
// two in step, and hand this file to the backend team with docs/api-contract-changes.md.

type Param = [name: string, description: string, required?: boolean];

interface Endpoint {
  path: string;
  method?: "get" | "post";
  summary: string;
  tag: string;
  params?: Param[];
  /** Response schema name in components.schemas, `X[]` for an array, `Page<X>` for a page. */
  returns: string;
  body?: string;
}

const PAGE: Param[] = [
  ["page", "Page number, from 1"],
  ["pageSize", "Items per page (default 25, max 500)"],
];

const ENDPOINTS: Endpoint[] = [
  { path: "/pillars", summary: "Pillars and their themes", tag: "Indicators", returns: "Pillar[]" },
  {
    path: "/indicators",
    summary: "Search and filter indicators",
    tag: "Indicators",
    params: [
      ["q", "Text search on code, name and synonyms"],
      ["pillar", "Pillar code"],
      ["theme", "Theme code"],
      ["geo_level", "Only indicators published at this level (national, adm1, adm2)"],
      ["headline", "true for headline indicators"],
      ["status", "published, in_collection or planned"],
      ["area", "Area code for the `latest` values (default: the country)"],
      ...PAGE,
    ],
    returns: "Page<IndicatorSummary>",
  },
  {
    path: "/indicators/{code}",
    summary: "Full metadata for one indicator",
    tag: "Indicators",
    params: [["code", "Indicator code, e.g. CONN.4G_POP", true]],
    returns: "Indicator",
  },
  {
    path: "/areas",
    summary: "Country, sub-national areas, peer economies and groups",
    tag: "Areas",
    params: [
      ["level", "country, adm1, adm2, adm3 or group"],
      ["parent", "Parent area code"],
      ["q", "Text search on the name"],
    ],
    returns: "Area[]",
  },
  {
    path: "/areas/{code}/geometry",
    summary: "Boundaries as TopoJSON (one `areas` object, geometries carry `code` and `name`)",
    tag: "Areas",
    params: [
      ["code", "Area code", true],
      ["level", "adm1, adm2 or adm3", true],
    ],
    returns: "Topology",
  },
  {
    path: "/series",
    summary: "Time series for one indicator and area",
    tag: "Data",
    params: [
      ["indicator", "Indicator code", true],
      ["area", "Area code, ISO3 peer or peer:GROUP", true],
      ["years", "Range, e.g. 2015-2025"],
      ["dims", "Breakdown, e.g. sex:F or sex:* for every category"],
      ["unit", "Unit variant code"],
    ],
    returns: "Series[]",
  },
  {
    path: "/data",
    summary: "Observations in long format; CSV, XLSX, JSON or SDMX-CSV",
    tag: "Data",
    params: [
      ["indicator", "One or more indicator codes, comma-separated", true],
      ["area", "Area codes, comma-separated (peers and peer:GROUP allowed)"],
      ["level", "All areas at this level"],
      ["year", "Range, e.g. 2018-2025"],
      ["dims", "Breakdown filter"],
      ["unit", "Unit variant code"],
      ["format", "json (default), csv, xlsx or sdmx-csv"],
      ...PAGE,
    ],
    returns: "Page<Observation>",
  },
  {
    path: "/data/latest",
    summary: "Latest observation per area",
    tag: "Data",
    params: [
      ["indicator", "Indicator code", true],
      ["area", "Area code"],
      ["level", "All areas at this level"],
      ["unit", "Unit variant code"],
    ],
    returns: "Observation[]",
  },
  {
    path: "/benchmark",
    summary: "Peer comparison with group statistics and rank history",
    tag: "Data",
    params: [
      ["indicator", "Indicator code", true],
      ["group", "Peer group key, e.g. ECOWAS", true],
      ["year", "Reference year (default: latest)"],
    ],
    returns: "Benchmark",
  },
  {
    path: "/datasets",
    summary: "Bulk datasets for open data",
    tag: "Open data",
    returns: "Dataset[]",
  },
  {
    path: "/datasets/{code}/file",
    summary: "Download a dataset",
    tag: "Open data",
    params: [
      ["code", "Dataset code, or ALL for every observation", true],
      ["format", "csv (default) or json"],
    ],
    returns: "Observation[]",
  },
  {
    path: "/publications",
    summary: "Reports and studies",
    tag: "Content",
    params: [
      ["type", "quarterly, annual, study or method"],
      ["year", "Publication year"],
      ["pillar", "Pillar code"],
      ...PAGE,
    ],
    returns: "Page<Publication>",
  },
  {
    path: "/news",
    summary: "News and technology watch",
    tag: "Content",
    params: [["kind", "news or watch"], ["tag", "Tag"], ...PAGE],
    returns: "Page<NewsItem>",
  },
  {
    path: "/api-keys",
    method: "post",
    summary: "Request an API key",
    tag: "Access",
    body: "ApiKeyInput",
    returns: "Ok",
  },
];

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});
const str = { type: "string" };
const num = { type: "number" };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const list = (items: unknown) => ({ type: "array", items });

const SCHEMAS: Record<string, unknown> = {
  Pillar: obj({
    code: str,
    name: str,
    description: str,
    order: num,
    themes: list(obj({ code: str, name: str })),
  }),
  IndicatorSummary: obj(
    {
      code: str,
      name: str,
      shortDefinition: str,
      pillar: str,
      theme: str,
      unit: str,
      periodicity: { enum: ["monthly", "quarterly", "annual", "biennial"] },
      geoLevels: list(str),
      disaggregations: list(str),
      higherIsBetter: { type: "boolean" },
      source: obj({ org: str, method: str }),
      status: { enum: ["published", "in_collection", "planned"] },
      lastUpdated: { type: "string", format: "date" },
      nextRelease: { type: "string", description: "YYYY-MM" },
    },
    ["code", "name", "pillar", "unit", "status"],
  ),
  Indicator: {
    allOf: [
      ref("IndicatorSummary"),
      obj({
        definition: str,
        computation: str,
        licence: str,
        coverage: obj({ from: str, to: str, areas: num }),
      }),
    ],
  },
  Area: obj({ code: str, level: str, name: str, parent: str, iso3: str }, [
    "code",
    "level",
    "name",
  ]),
  Topology: obj({ type: { const: "Topology" }, objects: obj({}), arcs: list(list(list(num))) }),
  Observation: obj(
    {
      indicator: str,
      area: str,
      period: { type: "string", description: "2025, 2025-Q3 or 2025-07" },
      value: { type: ["number", "null"] },
      unit: str,
      status: {
        enum: ["A", "E", "P", "B"],
        description: "Actual, estimated, provisional, break in series",
      },
      dims: { type: "object", additionalProperties: str },
    },
    ["indicator", "area", "period", "value"],
  ),
  Series: obj({
    indicator: str,
    area: str,
    dims: obj({}),
    points: list(obj({ period: str, value: num, status: str })),
  }),
  Benchmark: obj({
    indicator: str,
    group: str,
    year: str,
    rows: list(obj({ area: str, value: num, rank: num })),
  }),
  Dataset: obj({
    code: str,
    title: str,
    description: str,
    formats: list(str),
    licence: str,
    updateFrequency: str,
    lastUpdated: str,
    url: str,
  }),
  Publication: obj({
    slug: str,
    type: str,
    title: str,
    summary: str,
    date: str,
    fileUrl: str,
    fileBytes: num,
    verified: { type: "boolean" },
  }),
  NewsItem: obj({
    slug: str,
    title: str,
    excerpt: str,
    body: str,
    date: str,
    tags: list(str),
    kind: { enum: ["news", "watch"] },
    sourceUrl: str,
  }),
  ApiKeyInput: obj(
    {
      name: str,
      email: { type: "string", format: "email" },
      organisation: str,
      intendedUse: str,
      acceptedTerms: { const: true },
    },
    ["name", "email", "organisation", "intendedUse", "acceptedTerms"],
  ),
  Ok: obj({ ok: { const: true } }),
  Problem: obj({
    type: str,
    title: str,
    status: num,
    detail: str,
    errors: list(obj({ path: str, message: str })),
  }),
};

function responseSchema(returns: string) {
  const page = /^Page<(\w+)>$/.exec(returns);
  if (page)
    return obj({
      items: list(ref(page[1] as string)),
      meta: obj({ total: num, page: num, pageSize: num }),
    });
  if (returns.endsWith("[]")) return list(ref(returns.slice(0, -2)));
  return ref(returns);
}

export function openApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of ENDPOINTS) {
    const method = endpoint.method ?? "get";
    paths[endpoint.path] ??= {};
    paths[endpoint.path]![method] = {
      tags: [endpoint.tag],
      summary: endpoint.summary,
      parameters: [
        ...(endpoint.params ?? []).map(([name, description, required]) => ({
          name,
          in: endpoint.path.includes(`{${name}}`) ? "path" : "query",
          required: Boolean(required) || endpoint.path.includes(`{${name}}`),
          description,
          schema: str,
        })),
        {
          name: "Accept-Language",
          in: "header",
          description: "Response language; untranslated text falls back and sets `fallback: true`",
          schema: str,
        },
      ],
      ...(endpoint.body
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: ref(endpoint.body) } },
            },
          }
        : {}),
      responses: {
        [method === "post" ? "201" : "200"]: {
          description: "OK",
          content: { "application/json": { schema: responseSchema(endpoint.returns) } },
        },
        "4XX": {
          description: "Problem details (RFC 9457)",
          content: { "application/problem+json": { schema: ref("Problem") } },
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "National Digital Observatory API",
      version: "1.0.0",
      description: "Open data on the country's digital transformation. Data: CC BY 4.0.",
    },
    servers: [{ url: "/api/v1" }],
    tags: ["Indicators", "Areas", "Data", "Open data", "Content", "Access"].map((name) => ({
      name,
    })),
    paths,
    components: { schemas: SCHEMAS },
  };
}

/** Grey placeholder picture with the size in the middle, for images the mock has no file for. */
export function placeholderSvg(width: number, height: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#DDE2E8"/><text x="50%" y="50%" fill="#5B6573" font-family="sans-serif" font-size="32" text-anchor="middle" dominant-baseline="middle">${width} × ${height}</text></svg>`;
}
