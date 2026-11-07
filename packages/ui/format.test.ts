import { describe, expect, it } from "vitest";
import { describeChange, formatPeriod, formatValue, unitIsInline } from "./format";
import { linearTrend, targetStatus } from "./trend";

// Intl uses non-breaking and narrow non-breaking spaces in French.
const nbsp = (text: string) => text.replace(/[\u00a0\u202f]/g, " ");

describe("formatValue", () => {
  it("formats percentages with one decimal and the locale's spacing", () => {
    expect(formatValue(43.7, "pct", "en-SN")).toBe("43.7%");
    expect(nbsp(formatValue(43.7, "pct", "fr-SN"))).toBe("43,7 %");
  });

  it("formats per-100 rates with one decimal", () => {
    expect(formatValue(92, "per100", "en-SN")).toBe("92.0");
  });

  it("groups counts and shortens them on cards", () => {
    expect(formatValue(1234567, "count", "en-SN")).toBe("1,234,567");
    expect(formatValue(1234567, "count", "en-SN", { compact: true })).toBe("1.2M");
    expect(nbsp(formatValue(850000, "count", "fr-SN", { compact: true }))).toBe("850 k");
  });

  it("formats currency with the config currency", () => {
    expect(nbsp(formatValue(34000, "xof", "fr-SN"))).toMatch(/34 000\s?F\s?CFA/);
  });

  it("shows a dash for missing values", () => {
    expect(formatValue(null, "pct", "fr-SN")).toBe("—");
    expect(formatValue(undefined, "count", "fr-SN")).toBe("—");
  });

  it("formats Wolof through its configured fallback tag", () => {
    expect(nbsp(formatValue(43.7, "pct", "fr-SN"))).toBe("43,7 %");
  });

  it("knows which kinds carry their unit", () => {
    expect(unitIsInline("pct")).toBe(true);
    expect(unitIsInline("per100")).toBe(false);
  });
});

describe("formatPeriod", () => {
  it("formats quarters by language", () => {
    expect(formatPeriod("2025-Q3", "fr-SN")).toBe("T3 2025");
    expect(formatPeriod("2025-Q3", "en-SN")).toBe("Q3 2025");
    expect(formatPeriod("2025", "fr-SN")).toBe("2025");
  });
});

describe("describeChange", () => {
  it("colours by direction and higherIsBetter", () => {
    expect(describeChange(3, true)).toEqual({ direction: "up", tone: "good" });
    expect(describeChange(3, false)).toEqual({ direction: "up", tone: "bad" });
    expect(describeChange(-2, false)).toEqual({ direction: "down", tone: "good" });
  });

  it("treats ±0.5 % as flat", () => {
    expect(describeChange(0.4, true)).toEqual({ direction: "flat", tone: "neutral" });
  });
});

describe("targetStatus", () => {
  const rising = [2020, 2021, 2022, 2023, 2024].map((year, i) => ({ year, value: 50 + i * 5 }));

  it("fits a straight line", () => {
    expect(linearTrend(rising)?.slope).toBeCloseTo(5);
  });

  it("is on track when the projection reaches the target", () => {
    expect(targetStatus(rising, 80, 2030)).toBe("on_track");
  });

  it("is at risk when the projection nearly reaches it", () => {
    expect(targetStatus(rising, 101, 2030)).toBe("at_risk");
  });

  it("is off track when the projection falls well short", () => {
    expect(targetStatus(rising, 200, 2030)).toBe("off_track");
  });

  it("handles lower-is-better targets", () => {
    const falling = rising.map((point) => ({ ...point, value: 100 - (point.value - 50) }));
    expect(targetStatus(falling, 60, 2030, false)).toBe("on_track");
  });

  it("ignores gaps and needs two points", () => {
    expect(targetStatus([{ year: 2024, value: 1 }], 2, 2030)).toBeUndefined();
    expect(targetStatus([...rising, { year: 2025, value: null }], 80, 2030)).toBe("on_track");
  });
});
