import { describe, expect, it } from "vitest";
import { allowedSections, canOpen, sectionFor } from "./sections";

describe("sections", () => {
  it("finds the section for nested paths", () => {
    expect(sectionFor("/submissions/SUB-0001")?.key).toBe("submissions");
    expect(sectionFor("/")?.key).toBe("dashboard");
    expect(sectionFor("/submissionsx")).toBeUndefined();
  });

  it("refuses sections the role can't reach and unknown paths", () => {
    expect(canOpen("/users", ["contributor"])).toBe(false);
    expect(canOpen("/users", ["admin"])).toBe(true);
    expect(canOpen("/nope", ["super_admin"])).toBe(false);
    expect(canOpen("/calendar", ["reader"])).toBe(true);
    expect(canOpen("/login", ["reader"])).toBe(true);
  });

  it("gives every role the dashboard and only super admins settings", () => {
    for (const role of ["super_admin", "admin", "editor", "contributor", "reader"] as const) {
      expect(allowedSections([role]).some((item) => item.key === "dashboard")).toBe(true);
    }
    expect(allowedSections(["admin"]).some((item) => item.key === "settings")).toBe(false);
    expect(allowedSections(["super_admin"]).some((item) => item.key === "settings")).toBe(true);
  });
});
