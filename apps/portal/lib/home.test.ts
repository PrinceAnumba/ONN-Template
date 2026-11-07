import type { Observation, Series } from "@onn/api-client/types";
import { describe, expect, it } from "vitest";
import { formatBytes, periodYear } from "./format";
import { extremes, targetProgress } from "./home";

const series = (values: (number | null)[]): Series => ({
  indicator: "X",
  area: "SEN",
  dims: {},
  unit: "%",
  points: values.map((value, i) => ({ period: String(2020 + i), value, status: "A" })),
});

describe("targetProgress", () => {
  it("places the target tick at 90 % and the value on the same scale", () => {
    const result = targetProgress(series([40, 45, 50]), 90, "2030", true);
    expect(result.targetShare).toBeCloseTo(0.9);
    expect(result.valueShare).toBeCloseTo(0.5);
    expect(result.current).toBe(50);
  });

  it("keeps a value past the target inside the bar", () => {
    expect(targetProgress(series([95, 99, 120]), 100, "2030", true).valueShare).toBe(1);
  });

  it("uses the latest known value when the last period is missing", () => {
    const result = targetProgress(series([40, 50, null]), 90, "2030", true);
    expect(result.current).toBe(50);
    expect(result.currentPeriod).toBe("2021");
  });

  it("computes a status from the trend", () => {
    expect(targetProgress(series([40, 50, 60]), 90, "2030", true).status).toBe("on_track");
    expect(targetProgress(series([40, 41, 42]), 90, "2030", true).status).toBe("off_track");
  });

  it("copes with no data", () => {
    const result = targetProgress(undefined, 90, "2030", true);
    expect(result.current).toBeNull();
    expect(result.status).toBeUndefined();
  });
});

describe("extremes", () => {
  const row = (area: string, value: number | null) => ({ area, value }) as unknown as Observation;

  it("finds the highest and lowest, skipping gaps", () => {
    const result = extremes([row("A", 3), row("B", null), row("C", 9), row("D", 1)]);
    expect(result?.highest.area).toBe("C");
    expect(result?.lowest.area).toBe("D");
  });

  it("returns nothing without values", () => {
    expect(extremes([row("A", null)])).toBeUndefined();
  });
});

describe("format helpers", () => {
  it("turns quarters into fractional years", () => {
    expect(periodYear("2025")).toBe(2025);
    expect(periodYear("2025-Q3")).toBe(2025.5);
  });

  it("formats file sizes", () => {
    expect(formatBytes(4_200_000, "en")).toBe("4.2 MB");
    expect(formatBytes(420_000, "en")).toBe("420 kB");
  });
});
