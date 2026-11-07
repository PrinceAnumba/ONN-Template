import { describe, expect, it } from "vitest";
import { findInvalidParams, routeFromPath, serializeUrlState, withoutParams } from "./url-state";

const known = {
  indicators: new Set(["A", "B"]),
  areas: new Set(["SEN", "SN-01"]),
  comparisons: new Set(["SN-01", "GHA", "peer:ECOWAS"]),
  levels: new Set(["adm1", "adm2"]),
};
const invalid = (query: string) => findInvalidParams(new URLSearchParams(query), known);

describe("findInvalidParams", () => {
  it("accepts a full valid link", () => {
    expect(
      invalid("i=A,B&a=SN-01&c=peer:ECOWAS&y=2015-2025&d=sex:female,area:urban&u=pct&v=map&l=adm2"),
    ).toEqual([]);
  });

  it("accepts a single year and wildcard dims", () => {
    expect(invalid("y=2024&d=sex:*")).toEqual([]);
  });

  it.each([
    ["i=A,NOPE", "i"],
    ["a=XX", "a"],
    ["c=peer:NOPE", "c"],
    ["y=20", "y"],
    ["y=2025-2015", "y"],
    ["d=sex", "d"],
    ["v=pie", "v"],
    ["l=adm9", "l"],
  ])("rejects %s", (query, key) => {
    expect(invalid(query)).toEqual([key]);
  });

  it("reports every bad parameter", () => {
    expect(invalid("a=XX&v=pie&y=2020")).toEqual(["a", "v"]);
  });
});

describe("serializeUrlState", () => {
  it("omits defaults", () => {
    expect(serializeUrlState({ a: null, c: null })).toBe("");
  });

  it("keeps other parameters and writes lists with commas", () => {
    const result = serializeUrlState(new URLSearchParams("y=2020"), { i: ["A", "B"], c: "GHA" });
    const params = new URLSearchParams(result);
    expect(params.get("y")).toBe("2020");
    expect(params.get("i")).toBe("A,B");
    expect(params.get("c")).toBe("GHA");
  });

  it("removes a value set back to null", () => {
    expect(serializeUrlState(new URLSearchParams("a=SN-01"), { a: null })).toBe("");
  });
});

describe("withoutParams", () => {
  it("does not change the original", () => {
    const params = new URLSearchParams("a=1&b=2");
    expect(withoutParams(params, ["a"]).toString()).toBe("b=2");
    expect(params.toString()).toBe("a=1&b=2");
  });
});

describe("routeFromPath", () => {
  it("reads an indicator route", () => {
    expect(routeFromPath("/data/CONN.4G_POP").indicator).toBe("CONN.4G_POP");
  });

  it("reads a dashboard route", () => {
    expect(routeFromPath("/dashboards/public").dashboard).toBe("public");
  });

  it("treats the map as query-driven", () => {
    expect(routeFromPath("/map").usesIndicatorRoute).toBe(false);
  });
});
