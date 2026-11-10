import { describe, expect, it } from "vitest";
import { diffJson } from "./governance";

describe("diffJson", () => {
  it("lists only the leaves that changed", () => {
    expect(
      diffJson(
        { name: "A", kind: "other", contacts: [{ email: "a@x.org" }], site: "https://x.org" },
        { name: "B", kind: "other", contacts: [{ email: "a@x.org" }, { email: "b@x.org" }] },
      ),
    ).toEqual([
      { path: "name", kind: "changed", before: "A", after: "B" },
      { path: "contacts.1.email", kind: "added", after: "b@x.org" },
      { path: "site", kind: "removed", before: "https://x.org" },
    ]);
  });

  it("handles a missing side, nulls and type changes", () => {
    expect(diffJson(undefined, { status: "invited", roles: ["editor"] })).toEqual([
      { path: "status", kind: "added", after: "invited" },
      { path: "roles.0", kind: "added", after: "editor" },
    ]);
    expect(diffJson({ value: null }, { value: "60" })).toEqual([
      { path: "value", kind: "changed", before: "null", after: "60" },
    ]);
    expect(diffJson({ tags: ["a"] }, { tags: "a" })).toEqual([
      { path: "tags", kind: "changed", before: '["a"]', after: "a" },
    ]);
    expect(diffJson({ a: 1 }, { a: 1 })).toEqual([]);
    expect(diffJson(undefined, undefined)).toEqual([]);
  });
});
