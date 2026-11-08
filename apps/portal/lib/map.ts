// Pure map helpers (brief §5.4), safe to import from client components.

interface Row {
  area: string;
  period: string;
  value: number | null;
}

/**
 * One value per area and year: the latest known value within the year, so quarterly indicators
 * map by year like annual ones.
 */
export function valuesByYear(rows: Row[]) {
  const years = [...new Set(rows.map((row) => row.period.slice(0, 4)))].sort();
  const index = new Map(years.map((year, i) => [year, i]));
  const latestPeriod: Record<string, (string | null)[]> = {};
  const values: Record<string, (number | null)[]> = {};
  for (const row of rows) {
    const i = index.get(row.period.slice(0, 4))!;
    values[row.area] ??= years.map(() => null);
    latestPeriod[row.area] ??= years.map(() => null);
    const seen = latestPeriod[row.area]![i];
    if (row.value !== null && (!seen || row.period > seen)) {
      values[row.area]![i] = row.value;
      latestPeriod[row.area]![i] = row.period;
    }
  }
  return { years, values };
}

/** Year shown first: the requested one if it has data, else the latest year with any value. */
export function initialYear(
  years: string[],
  values: Record<string, (number | null)[]>,
  requested: string | null,
) {
  const hasData = (i: number) => Object.values(values).some((row) => row[i] != null);
  const asked = requested ? years.indexOf(requested.slice(0, 4)) : -1;
  if (asked >= 0) return asked;
  for (let i = years.length - 1; i >= 0; i--) if (hasData(i)) return i;
  return Math.max(0, years.length - 1);
}

/**
 * Rank among areas sharing a parent at the same level, best first (highest when higher is
 * better). Areas without a value are left out of both the rank and the total.
 */
export function rankAmong(
  code: string,
  siblings: string[],
  values: Record<string, (number | null)[]>,
  yearIndex: number,
  higherIsBetter: boolean,
) {
  const own = values[code]?.[yearIndex];
  if (own == null) return undefined;
  const known = siblings
    .map((sibling) => values[sibling]?.[yearIndex])
    .filter((value): value is number => value != null);
  const better = known.filter((value) => (higherIsBetter ? value > own : value < own)).length;
  return { rank: better + 1, total: known.length };
}

/** Values for one year, keyed by area, for classification. */
export function yearSlice(
  codes: string[],
  values: Record<string, (number | null)[]>,
  yearIndex: number,
) {
  return Object.fromEntries(codes.map((code) => [code, values[code]?.[yearIndex] ?? null]));
}
