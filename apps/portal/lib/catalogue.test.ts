import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  catalogueSearch,
  facetCounts,
  filterRows,
  parseCatalogue,
  type CatalogueRow,
} from "./catalogue";

const row = (over: Partial<CatalogueRow>): CatalogueRow => ({
  code: "A.B",
  name: "Internet users",
  synonyms: [],
  pillar: "ACCESS",
  unit: "%",
  periodicity: "annual",
  source: "ANSD",
  intl: "",
  sub: "no",
  updated: "2025-01-01",
  updatedLabel: "1 January 2025",
  status: "published",
  ...over,
});

const rows = [
  row({ code: "ACCESS.USERS" }),
  row({ code: "CONN.4G", name: "4G population coverage", pillar: "CONN", sub: "yes" }),
  row({ code: "CONN.FIBRE", name: "Fibre network", pillar: "CONN", status: "planned" }),
  row({
    code: "SKILLS.ICT",
    name: "Compétences TIC",
    synonyms: ["digital skills"],
    pillar: "SKILLS",
  }),
];

describe("parseCatalogue", () => {
  it("reads comma lists and repeated keys, dropping duplicates", () => {
    const state = parseCatalogue({ q: " fibre ", pillar: ["CONN,ACCESS", "CONN"], sub: "yes" });
    expect(state.q).toBe("fibre");
    expect(state.filters.pillar).toEqual(["CONN", "ACCESS"]);
    expect(state.filters.sub).toEqual(["yes"]);
    expect(state.filters.status).toEqual([]);
  });

  it("round-trips through the URL", () => {
    const state = parseCatalogue({ q: "4g", pillar: "CONN,ACCESS", status: "planned" });
    const search = catalogueSearch(state);
    expect(search).toBe("q=4g&pillar=CONN,ACCESS&status=planned");
    expect(parseCatalogue(Object.fromEntries(new URLSearchParams(search)))).toEqual(state);
    expect(catalogueSearch(parseCatalogue({}))).toBe("");
  });
});

describe("filtering", () => {
  it("matches code, name and synonyms, ignoring accents and case", () => {
    expect(filterRows(rows, parseCatalogue({ q: "competences" })).map((r) => r.code)).toEqual([
      "SKILLS.ICT",
    ]);
    expect(filterRows(rows, parseCatalogue({ q: "digital skills" }))).toHaveLength(1);
    expect(filterRows(rows, parseCatalogue({ q: "conn." }))).toHaveLength(2);
  });

  it("ORs options within a facet and ANDs facets", () => {
    const state = parseCatalogue({ pillar: "CONN,SKILLS", status: "published" });
    expect(filterRows(rows, state).map((r) => r.code)).toEqual(["CONN.4G", "SKILLS.ICT"]);
    expect(activeFilterCount(state)).toBe(3);
  });

  it("counts each facet with the other facets applied", () => {
    const state = parseCatalogue({ pillar: "CONN", status: "published" });
    expect(Object.fromEntries(facetCounts(rows, state, "pillar"))).toEqual({
      ACCESS: 1,
      CONN: 1,
      SKILLS: 1,
    });
    expect(Object.fromEntries(facetCounts(rows, state, "status"))).toEqual({
      published: 1,
      planned: 1,
    });
  });
});
