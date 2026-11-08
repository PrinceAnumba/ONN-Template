import { describe, expect, it } from "vitest";
import { gapToMedian, nearestPeers, rankSeries } from "./benchmark";

const row = (area: string, rank: number, value: number | null = 10) => ({
  area,
  name: area,
  value,
  year: "2024",
  rank,
});

describe("nearestPeers", () => {
  const rows = [
    row("A", 1),
    row("B", 2),
    row("SEN", 3),
    row("C", 4),
    row("D", 5),
    row("E", 6, null),
    row("F", 7),
  ];

  it("takes the focus and the peers ranked closest, ignoring missing values", () => {
    expect(nearestPeers(rows, "SEN")).toEqual(["SEN", "B", "C", "A", "D"]);
  });

  it("falls back to the top of the ranking without the focus", () => {
    expect(nearestPeers(rows, "XXX", 2)).toEqual(["A", "B"]);
  });
});

describe("gapToMedian", () => {
  it("signs the gap and colours it by direction", () => {
    expect(gapToMedian(60, 50, true)).toEqual({ gap: 10, tone: "good" });
    expect(gapToMedian(60, 50, false)).toEqual({ gap: 10, tone: "bad" });
    expect(gapToMedian(50, 50, true)).toEqual({ gap: 0, tone: "neutral" });
    expect(gapToMedian(null, 50, true)).toBeUndefined();
  });
});

describe("rankSeries", () => {
  it("aligns every economy on the same years", () => {
    const series = rankSeries(
      [
        { area: "SEN", name: "Senegal", year: "2023", rank: 4 },
        { area: "SEN", name: "Senegal", year: "2024", rank: 3 },
        { area: "B", name: "Benin", year: "2024", rank: 2 },
      ],
      ["SEN", "B"],
    );
    expect(series[1]?.points).toEqual([
      { period: "2023", value: null },
      { period: "2024", value: 2 },
    ]);
  });
});
