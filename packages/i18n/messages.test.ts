import { describe, expect, it } from "vitest";
import en from "./messages/en.json";
import fr from "./messages/fr.json";
import wo from "./messages/wo.json";

function keys(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, item]) =>
    typeof item === "object" ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("message catalogues", () => {
  it.each([
    ["fr", fr],
    ["wo", wo],
  ])("%s has exactly the same keys as en", (_, catalogue) => {
    expect(keys(catalogue).sort()).toEqual(keys(en).sort());
  });
});
