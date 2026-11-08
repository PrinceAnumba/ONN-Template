// Pure helpers for the benchmark page (brief §5.6).
import type { PeerRow, RankHistoryRow } from "@onn/api-client/types";

/** The focus economy plus the `count` peers ranked closest to it in the latest year. */
export function nearestPeers(rows: PeerRow[], focus: string, count = 4) {
  const own = rows.find((row) => row.area === focus);
  if (!own) return rows.slice(0, count).map((row) => row.area);
  const others = rows
    .filter((row) => row.area !== focus && row.value !== null)
    .sort((a, b) => Math.abs(a.rank - own.rank) - Math.abs(b.rank - own.rank) || a.rank - b.rank)
    .slice(0, count);
  return [focus, ...others.map((row) => row.area)];
}

/** Signed gap to the median and whether it is good news, given the indicator's direction. */
export function gapToMedian(
  value: number | null,
  median: number | undefined,
  higherIsBetter: boolean,
) {
  if (value === null || median === undefined) return undefined;
  const gap = Math.round((value - median) * 10) / 10;
  if (gap === 0) return { gap, tone: "neutral" as const };
  return { gap, tone: gap > 0 === higherIsBetter ? ("good" as const) : ("bad" as const) };
}

/** Rank series per economy, oldest year first, for the slope chart. */
export function rankSeries(history: RankHistoryRow[], areas: string[]) {
  const years = [...new Set(history.map((row) => row.year))].sort();
  return areas.map((area) => {
    const rows = history.filter((row) => row.area === area);
    return {
      area,
      name: rows[0]?.name ?? area,
      points: years.map((year) => ({
        period: year,
        value: rows.find((row) => row.year === year)?.rank ?? null,
      })),
    };
  });
}
