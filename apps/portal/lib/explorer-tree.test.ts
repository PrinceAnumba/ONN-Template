import { describe, expect, it } from "vitest";
import { filterTree, trendOf, type TreePillar } from "./explorer-tree";

const tree: TreePillar[] = [
  {
    code: "ACCESS",
    name: "Access and use",
    count: 2,
    themes: [
      {
        code: "IND",
        name: "Individuals",
        indicators: [
          { code: "ACCESS.INTERNET_USERS", name: "Internet users", synonyms: ["internautes"] },
          { code: "ACCESS.MOBILE_OWN", name: "Mobile phone ownership", synonyms: [] },
        ],
      },
    ],
  },
  {
    code: "TRUST",
    name: "Trust",
    count: 1,
    themes: [
      {
        code: "SEC",
        name: "Security",
        indicators: [{ code: "TRUST.GCI", name: "Indice de cybersécurité", synonyms: [] }],
      },
    ],
  },
];

describe("filterTree", () => {
  it("returns the tree unchanged for an empty query", () => {
    expect(filterTree(tree, "  ")).toBe(tree);
  });

  it("matches names, codes and synonyms, and recounts", () => {
    const result = filterTree(tree, "internaute");
    expect(result).toHaveLength(1);
    expect(result[0]?.count).toBe(1);
    expect(filterTree(tree, "trust.gci")[0]?.code).toBe("TRUST");
  });

  it("ignores accents and case", () => {
    expect(filterTree(tree, "CYBERSECURITE")[0]?.themes[0]?.indicators).toHaveLength(1);
  });

  it("drops empty branches", () => {
    expect(filterTree(tree, "nothing")).toEqual([]);
  });
});

describe("trendOf", () => {
  it("uses the ±0.5 % flat band", () => {
    expect(trendOf(0.4)).toBe("flat");
    expect(trendOf(-2)).toBe("down");
    expect(trendOf(3)).toBe("up");
    expect(trendOf(undefined)).toBe("none");
  });
});
