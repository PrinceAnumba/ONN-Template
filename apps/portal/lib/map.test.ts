import { describe, expect, it } from "vitest";
import { initialYear, rankAmong, valuesByYear, yearSlice } from "./map";

describe("valuesByYear", () => {
  it("aligns areas on the same years and keeps gaps", () => {
    const { years, values } = valuesByYear([
      { area: "A", period: "2023", value: 1 },
      { area: "A", period: "2024", value: 2 },
      { area: "B", period: "2024", value: null },
    ]);
    expect(years).toEqual(["2023", "2024"]);
    expect(values).toEqual({ A: [1, 2], B: [null, null] });
  });

  it("takes the latest known quarter within a year", () => {
    const { values } = valuesByYear([
      { area: "A", period: "2024-Q4", value: null },
      { area: "A", period: "2024-Q3", value: 3 },
      { area: "A", period: "2024-Q1", value: 1 },
    ]);
    expect(values.A).toEqual([3]);
  });
});

describe("initialYear", () => {
  const values = { A: [1, 2, null], B: [null, null, null] };
  const years = ["2023", "2024", "2025"];

  it("skips trailing years with no data", () => {
    expect(initialYear(years, values, null)).toBe(1);
  });

  it("honours a requested year, ignoring a range end", () => {
    expect(initialYear(years, values, "2023")).toBe(0);
    expect(initialYear(years, values, "1999")).toBe(1);
  });
});

describe("rankAmong", () => {
  const values = { A: [10], B: [30], C: [20], D: [null] };
  const siblings = ["A", "B", "C", "D"];

  it("ranks best first and leaves out missing values", () => {
    expect(rankAmong("C", siblings, values, 0, true)).toEqual({ rank: 2, total: 3 });
    expect(rankAmong("C", siblings, values, 0, false)).toEqual({ rank: 2, total: 3 });
    expect(rankAmong("A", siblings, values, 0, false)).toEqual({ rank: 1, total: 3 });
  });

  it("has no rank without a value", () => {
    expect(rankAmong("D", siblings, values, 0, true)).toBeUndefined();
  });

  it("slices one year for classification", () => {
    expect(yearSlice(["A", "D", "Z"], values, 0)).toEqual({ A: 10, D: null, Z: null });
  });
});
