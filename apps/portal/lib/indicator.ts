// Pure helpers for the explorer and indicator page (brief §5.2, §5.3), kept out of components so
// they can be unit tested.
import type { Indicator, ObsStatus, PeerStats, Series } from "@onn/api-client/types";

export type Point = Series["points"][number];

/** Year range from the `y` parameter, clamped to the indicator's coverage. */
export function yearRange(param: string | null, from: number, to: number): [number, number] {
  const match = param ? /^(\d{4})(?:-(\d{4}))?$/.exec(param) : null;
  if (!match) return [from, to];
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  const clamp = (year: number) => Math.min(Math.max(year, from), to);
  return [clamp(start), clamp(end)];
}

/** The `y` value for a range, or null when it is the full coverage (defaults stay out of the URL). */
export function yearParam(range: [number, number], from: number, to: number) {
  if (range[0] === from && range[1] === to) return null;
  return range[0] === range[1] ? String(range[0]) : `${range[0]}-${range[1]}`;
}

export const inRange = (period: string, [from, to]: [number, number]) => {
  const year = Number(period.slice(0, 4));
  return year >= from && year <= to;
};

/**
 * The disaggregation shown, from `d` entries such as `sex:*`. Only keys the indicator offers count;
 * anything else falls back to the total.
 */
export function selectedDisaggregation(d: string[] | null, offered: string[]) {
  const key = d?.map((pair) => pair.split(":")[0]).find((k) => k && offered.includes(k));
  return key ?? null;
}

/** The unit variant shown; the first variant is the default and stays out of the URL. */
export function selectedUnit(u: string | null, indicator: Pick<Indicator, "unitVariants">) {
  const variants = indicator.unitVariants;
  return variants.find((variant) => variant.code === u) ?? variants[0];
}

export interface LatestPoint {
  value: number;
  period: string;
  status: ObsStatus;
  /** Change on the previous non-null point, in percent. */
  changePct?: number;
}

export function latestPoint(points: Point[]): LatestPoint | undefined {
  const known = points.filter((point) => point.value !== null);
  const last = known.at(-1);
  if (!last || last.value === null) return undefined;
  const previous = known.at(-2)?.value;
  return {
    value: last.value,
    period: last.period,
    status: last.status,
    changePct: previous ? Math.round(((last.value - previous) / previous) * 1000) / 10 : undefined,
  };
}

/** First and last known points, for the text summary. */
export function endpoints(points: Point[]) {
  const known = points.filter((point): point is Point & { value: number } => point.value !== null);
  const first = known[0];
  const last = known.at(-1);
  if (!first || !last) return undefined;
  const direction =
    last.value > first.value ? "up" : last.value < first.value ? "down" : ("same" as const);
  return { first, last, direction };
}

/** Peer group band (min to max) inside the year range. */
export function peerBand(stats: PeerStats[], range: [number, number]) {
  return stats
    .filter((row) => inRange(row.year, range))
    .map((row) => ({ period: row.year, min: row.min, max: row.max }));
}

export interface TableRow {
  id: string;
  name: string;
  /** Values and flags by period. */
  cells: Record<string, { value: number | null; status: ObsStatus }>;
}

/** Rows are series (areas or categories), columns are periods, latest first. */
export function seriesTable(series: { id: string; name: string; points: Point[] }[]) {
  const periods = new Set<string>();
  const rows: TableRow[] = series.map((item) => {
    const cells: TableRow["cells"] = {};
    for (const point of item.points) {
      periods.add(point.period);
      cells[point.period] = { value: point.value, status: point.status };
    }
    return { id: item.id, name: item.name, cells };
  });
  return { periods: [...periods].sort().reverse(), rows };
}

/** Flags that need a superscript and a legend entry in the table. */
export const FLAGGED: ObsStatus[] = ["E", "P", "B", "F", "M"];

export function flagsIn(rows: TableRow[]) {
  const seen = new Set<ObsStatus>();
  for (const row of rows) {
    for (const cell of Object.values(row.cells)) {
      if (FLAGGED.includes(cell.status)) seen.add(cell.status);
    }
  }
  return FLAGGED.filter((status) => seen.has(status));
}

/** Key used to label one disaggregated series, e.g. "female" from `{ sex: "female" }`. */
export const categoryOf = (dims: Record<string, string>, key: string) => dims[key] ?? "";

export const isSubnational = (indicator: Pick<Indicator, "geoLevels">) =>
  indicator.geoLevels.some((level) => level !== "national");
