import { describe, expect, it } from "vitest";
import {
  endpoints,
  flagsIn,
  latestPoint,
  peerBand,
  selectedDisaggregation,
  selectedUnit,
  seriesTable,
  yearParam,
  yearRange,
} from "./indicator";

describe("yearRange", () => {
  it("defaults to the full coverage", () => {
    expect(yearRange(null, 2015, 2025)).toEqual([2015, 2025]);
    expect(yearRange("nonsense", 2015, 2025)).toEqual([2015, 2025]);
  });

  it("reads a single year and a range, clamped to coverage", () => {
    expect(yearRange("2020", 2015, 2025)).toEqual([2020, 2020]);
    expect(yearRange("2010-2030", 2015, 2025)).toEqual([2015, 2025]);
  });

  it("round-trips through yearParam, leaving defaults out", () => {
    expect(yearParam([2015, 2025], 2015, 2025)).toBeNull();
    expect(yearParam([2018, 2025], 2015, 2025)).toBe("2018-2025");
    expect(yearParam([2020, 2020], 2015, 2025)).toBe("2020");
  });
});

describe("selections", () => {
  it("ignores a disaggregation the indicator does not offer", () => {
    expect(selectedDisaggregation(["operator:*"], ["sex"])).toBeNull();
    expect(selectedDisaggregation(["sex:*"], ["sex", "area"])).toBe("sex");
    expect(selectedDisaggregation(null, ["sex"])).toBeNull();
  });

  it("falls back to the first unit variant", () => {
    const indicator = {
      unitVariants: [
        { code: "pct", label: "%" },
        { code: "people", label: "people" },
      ],
    };
    expect(selectedUnit("people", indicator)?.code).toBe("people");
    expect(selectedUnit("nope", indicator)?.code).toBe("pct");
  });
});

describe("latestPoint", () => {
  it("skips gaps and measures change on the previous known value", () => {
    const latest = latestPoint([
      { period: "2022", value: 40, status: "A" },
      { period: "2023", value: null, status: "M" },
      { period: "2024", value: 50, status: "P" },
      { period: "2025", value: null, status: "M" },
    ]);
    expect(latest).toEqual({ value: 50, period: "2024", status: "P", changePct: 25 });
  });

  it("returns nothing without data", () => {
    expect(latestPoint([{ period: "2024", value: null, status: "M" }])).toBeUndefined();
  });
});

describe("endpoints", () => {
  it("reports the direction between the first and last known values", () => {
    const result = endpoints([
      { period: "2015", value: null, status: "M" },
      { period: "2016", value: 30, status: "A" },
      { period: "2024", value: 20, status: "A" },
    ]);
    expect(result?.first.period).toBe("2016");
    expect(result?.direction).toBe("down");
  });
});

describe("tables", () => {
  const table = seriesTable([
    {
      id: "SEN",
      name: "Senegal",
      points: [
        { period: "2023", value: 1, status: "A" },
        { period: "2024", value: 2, status: "E" },
      ],
    },
    { id: "SN-01", name: "Dakar", points: [{ period: "2024", value: null, status: "M" }] },
  ]);

  it("puts the latest period first", () => {
    expect(table.periods).toEqual(["2024", "2023"]);
    expect(table.rows[1]?.cells["2023"]).toBeUndefined();
  });

  it("lists only the flags present, in a fixed order", () => {
    expect(flagsIn(table.rows)).toEqual(["E", "M"]);
  });

  it("keeps the peer band inside the range", () => {
    const stats = [
      { year: "2019", median: 1, min: 0, max: 2 },
      { year: "2024", median: 3, min: 2, max: 4 },
    ];
    expect(peerBand(stats, [2020, 2025])).toEqual([{ period: "2024", min: 2, max: 4 }]);
  });
});
