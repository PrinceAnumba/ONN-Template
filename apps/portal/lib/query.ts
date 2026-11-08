// Pure helpers for the data query tool (brief §5.7): URL state, the API URL and code snippets.

export const DEFAULT_YEARS = 8;
export const PREVIEW_ROWS = 100;

export interface QueryState {
  indicators: string[];
  areas: string[];
  years: [number, number];
}

const list = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value.join(",") : (value ?? "")).split(",").filter(Boolean);

/** Reads `i`, `a` (a comma list here) and `y`; years default to the last eight with data. */
export function parseQuery(
  params: Record<string, string | string[] | undefined>,
  coverage: [number, number],
): QueryState {
  const [min, max] = coverage;
  const fallback: [number, number] = [Math.max(min, max - DEFAULT_YEARS + 1), max];
  const match = /^(\d{4})(?:-(\d{4}))?$/.exec(String(params.y ?? ""));
  let years = fallback;
  if (match) {
    const clamp = (year: number) => Math.min(Math.max(year, min), max);
    const from = clamp(Number(match[1]));
    const to = clamp(Number(match[2] ?? match[1]));
    years = from <= to ? [from, to] : fallback;
  }
  return { indicators: list(params.i), areas: list(params.a), years };
}

export const isComplete = (state: QueryState) =>
  state.indicators.length > 0 && state.areas.length > 0;

/** Query string with commas kept readable, e.g. `i=A.B,C.D&a=SEN&y=2018-2025`. */
export function queryString(state: QueryState) {
  const join = (values: string[]) => values.map(encodeURIComponent).join(",");
  return `i=${join(state.indicators)}&a=${join(state.areas)}&y=${state.years[0]}-${state.years[1]}`;
}

/** The `/data` call that returns what the preview shows. */
export function apiUrl(base: string, state: QueryState, format: string) {
  const join = (values: string[]) => values.map(encodeURIComponent).join(",");
  return `${base}/api/v1/data?indicator=${join(state.indicators)}&area=${join(state.areas)}&year=${state.years[0]}-${state.years[1]}&format=${format}`;
}

export function snippets(base: string, state: QueryState) {
  const csv = apiUrl(base, state, "csv");
  const json = apiUrl(base, state, "json");
  return {
    curl: `curl -L "${csv}" -o onn-data.csv`,
    python: `import pandas as pd\n\ndf = pd.read_csv("${csv}")\nprint(df.head())`,
    r: `df <- read.csv("${csv}")\nhead(df)`,
    js: `const response = await fetch("${json}");\nconst { items, meta } = await response.json();\nconsole.log(meta.total, items[0]);`,
  };
}
