import { createSerializer, parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs/server";

export const VIEWS = ["chart", "table", "map"] as const;

/** URL state from brief §4.4. Defaults are null, so they never appear in the URL. */
export const urlParsers = {
  i: parseAsArrayOf(parseAsString, ","),
  a: parseAsString,
  c: parseAsString,
  y: parseAsString,
  d: parseAsArrayOf(parseAsString, ","),
  u: parseAsString,
  v: parseAsStringLiteral(VIEWS),
  l: parseAsString,
};

export const serializeUrlState = createSerializer(urlParsers);

export interface KnownValues {
  indicators: Set<string>;
  areas: Set<string>;
  comparisons: Set<string>;
  levels: Set<string>;
}

function isValidYears(value: string) {
  const match = /^(\d{4})(?:-(\d{4}))?$/.exec(value);
  if (!match) return false;
  return !match[2] || (match[1] as string) <= match[2];
}

/** Names of the parameters a shared link can no longer honour. */
export function findInvalidParams(params: URLSearchParams, known: KnownValues): string[] {
  const check: Record<string, (value: string) => boolean> = {
    i: (value) => value.split(",").every((code) => known.indicators.has(code)),
    a: (value) => known.areas.has(value),
    c: (value) => known.comparisons.has(value),
    y: isValidYears,
    d: (value) => value.split(",").every((pair) => /^[\w-]+:[^:,]+$/.test(pair)),
    u: (value) => /^[\w-]+$/.test(value),
    v: (value) => (VIEWS as readonly string[]).includes(value),
    l: (value) => known.levels.has(value),
  };
  return Object.keys(check).filter((key) => {
    const value = params.get(key);
    return value !== null && !(check[key] as (value: string) => boolean)(value);
  });
}

export function withoutParams(params: URLSearchParams, keys: string[]) {
  const next = new URLSearchParams(params);
  keys.forEach((key) => next.delete(key));
  return next;
}

export function routeFromPath(pathname: string) {
  const [, section, slug] = pathname.split("/");
  return {
    indicator: section === "data" ? slug : undefined,
    dashboard: section === "dashboards" ? slug : undefined,
    usesIndicatorRoute: section === "data" || section === "dashboards",
  };
}
