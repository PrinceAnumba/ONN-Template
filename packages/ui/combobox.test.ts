import { describe, expect, it } from "vitest";
import { filterGroups, type ComboboxGroup } from "./components/combobox-filter";

const groups: ComboboxGroup[] = [
  {
    label: "A",
    options: [
      { value: "1", label: "Thiès" },
      { value: "2", label: "Dakar" },
    ],
  },
  { label: "B", options: [{ value: "3", label: "Mobile", keywords: ["CODE.X", "LTE"] }] },
];

describe("filterGroups", () => {
  it("returns everything for an empty query", () => {
    expect(filterGroups(groups, "  ")).toBe(groups);
  });

  it("ignores accents and case", () => {
    expect(filterGroups(groups, "THIES")[0]?.options[0]?.value).toBe("1");
  });

  it("searches keywords", () => {
    expect(filterGroups(groups, "lte")[0]?.label).toBe("B");
  });

  it("drops groups with no match", () => {
    expect(filterGroups(groups, "dakar")).toHaveLength(1);
    expect(filterGroups(groups, "zzz")).toEqual([]);
  });
});
