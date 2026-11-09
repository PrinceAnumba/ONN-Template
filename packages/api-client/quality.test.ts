import { describe, expect, it } from "vitest";
import { nextPeriod, parseNumber, previousPeriod, validPeriod, valueIssues } from "./quality";

describe("parseNumber", () => {
  it("reads both decimal conventions and spacing", () => {
    expect(parseNumber("1 234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("45 %")).toBe(45);
    expect(parseNumber("-3")).toBe(-3);
  });
  it("tells empty cells from text", () => {
    expect(parseNumber("  ")).toBeNull();
    expect(parseNumber("n/a")).toBeNaN();
    expect(parseNumber("12abc")).toBeNaN();
  });
});

describe("valueIssues", () => {
  it("flags missing, negative, range and jumps", () => {
    expect(valueIssues(null, "%", null).map((i) => i.rule)).toEqual(["missing"]);
    expect(valueIssues(-1, "nombre", null).map((i) => i.rule)).toEqual(["negative"]);
    expect(valueIssues(120, "%", 100).map((i) => i.rule)).toEqual(["range"]);
    expect(valueIssues(140, "nombre", 100).map((i) => i.rule)).toEqual(["jump"]);
    expect(valueIssues(110, "nombre", 100)).toEqual([]);
  });
});

describe("periods", () => {
  it("validates by periodicity", () => {
    expect(validPeriod("2025", "annual")).toBe(true);
    expect(validPeriod("2025-Q3", "quarterly")).toBe(true);
    expect(validPeriod("2025-Q5", "quarterly")).toBe(false);
    expect(validPeriod("2025-07", "monthly")).toBe(true);
    expect(validPeriod("25", "annual")).toBe(false);
  });
  it("steps forward and back", () => {
    expect(nextPeriod("2025-Q4", "quarterly")).toBe("2026-Q1");
    expect(nextPeriod("2025-12", "monthly")).toBe("2026-01");
    expect(nextPeriod("2024", "biennial")).toBe("2026");
    expect(previousPeriod("2026-Q1", "quarterly")).toBe("2025-Q4");
    expect(previousPeriod("2026-01", "monthly")).toBe("2025-12");
    expect(previousPeriod("2025", "annual")).toBe("2024");
  });
});
