export type TargetStatus = "on_track" | "at_risk" | "off_track";

export interface TrendPoint {
  year: number;
  value: number | null;
}

/** Least-squares line through the points that have a value. */
export function linearTrend(points: TrendPoint[]) {
  const known = points.filter(
    (point): point is { year: number; value: number } => point.value !== null,
  );
  if (known.length < 2) return undefined;
  const n = known.length;
  const meanX = known.reduce((sum, p) => sum + p.year, 0) / n;
  const meanY = known.reduce((sum, p) => sum + p.value, 0) / n;
  const covariance = known.reduce((sum, p) => sum + (p.year - meanX) * (p.value - meanY), 0);
  const variance = known.reduce((sum, p) => sum + (p.year - meanX) ** 2, 0);
  const slope = variance === 0 ? 0 : covariance / variance;
  return { slope, at: (year: number) => meanY + slope * (year - meanX) };
}

const AT_RISK_SHARE = 0.9;

/**
 * Projects the trend to the target year (brief §5.1). On track when the projection reaches the
 * target; at risk when it covers at least 90 % of the remaining distance; otherwise off track.
 */
export function targetStatus(
  points: TrendPoint[],
  target: number,
  targetYear: number,
  higherIsBetter = true,
): TargetStatus | undefined {
  const trend = linearTrend(points);
  const latest = [...points].reverse().find((point) => point.value !== null);
  if (!trend || !latest || latest.value === null) return undefined;
  const projected = trend.at(targetYear);
  const sign = higherIsBetter ? 1 : -1;
  if ((projected - target) * sign >= 0) return "on_track";
  const needed = (target - latest.value) * sign;
  const covered = (projected - latest.value) * sign;
  if (needed <= 0) return "on_track";
  return covered / needed >= AT_RISK_SHARE ? "at_risk" : "off_track";
}
