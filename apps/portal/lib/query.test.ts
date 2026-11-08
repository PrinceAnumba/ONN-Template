import { describe, expect, it } from "vitest";
import { apiUrl, isComplete, parseQuery, queryString, snippets } from "./query";

describe("parseQuery", () => {
  it("defaults to the last eight years and empty selections", () => {
    expect(parseQuery({}, [2015, 2025])).toEqual({
      indicators: [],
      areas: [],
      years: [2018, 2025],
    });
  });

  it("reads comma lists and clamps years to coverage", () => {
    const state = parseQuery({ i: "A.B,C.D", a: "SEN,peer:ECOWAS", y: "2010-2030" }, [2015, 2025]);
    expect(state).toEqual({
      indicators: ["A.B", "C.D"],
      areas: ["SEN", "peer:ECOWAS"],
      years: [2015, 2025],
    });
    expect(isComplete(state)).toBe(true);
  });

  it("ignores a reversed range", () => {
    expect(parseQuery({ y: "2024-2020" }, [2015, 2025]).years).toEqual([2018, 2025]);
  });
});

describe("URLs and snippets", () => {
  const state = {
    indicators: ["A.B"],
    areas: ["SEN", "peer:ECOWAS"],
    years: [2018, 2025] as [number, number],
  };

  it("keeps commas readable and encodes values", () => {
    expect(queryString(state)).toBe("i=A.B&a=SEN,peer%3AECOWAS&y=2018-2025");
    expect(apiUrl("https://x", state, "csv")).toBe(
      "https://x/api/v1/data?indicator=A.B&area=SEN,peer%3AECOWAS&year=2018-2025&format=csv",
    );
  });

  it("uses the same URL in every snippet", () => {
    const code = snippets("https://x", state);
    for (const snippet of [code.curl, code.python, code.r]) expect(snippet).toContain("format=csv");
    expect(code.js).toContain("format=json");
  });
});
