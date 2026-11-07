import type { Observation, Series } from "@onn/api-client/types";
import { targetStatus, type TargetStatus } from "@onn/ui/trend";
import { periodYear } from "./format";

/** Share of the bar the target tick sits at, leaving room past it. */
const TARGET_POSITION = 0.9;

export interface TargetProgressData {
  current: number | null;
  currentPeriod?: string;
  valueShare: number;
  targetShare: number;
  status?: TargetStatus;
}

/** Bar positions and trend status for one strategy target (brief §5.1). */
export function targetProgress(
  series: Series | undefined,
  target: number,
  targetYear: string,
  higherIsBetter: boolean,
): TargetProgressData {
  const points = (series?.points ?? []).map((point) => ({
    year: periodYear(point.period),
    value: point.value,
  }));
  const latest = [...(series?.points ?? [])].reverse().find((point) => point.value !== null);
  const scale = Math.max(target / TARGET_POSITION, latest?.value ?? 0) || 1;
  return {
    current: latest?.value ?? null,
    currentPeriod: latest?.period,
    valueShare: (latest?.value ?? 0) / scale,
    targetShare: target / scale,
    status: targetStatus(points, target, Number(targetYear), higherIsBetter),
  };
}

/** Highest and lowest area on the latest values, for the map teaser. */
export function extremes(rows: Observation[]) {
  const known = rows.filter((row): row is Observation & { value: number } => row.value !== null);
  if (known.length === 0) return undefined;
  const sorted = [...known].sort((a, b) => b.value - a.value);
  return { highest: sorted[0]!, lowest: sorted[sorted.length - 1]! };
}
