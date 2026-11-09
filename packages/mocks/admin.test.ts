import type { AdminMe, AdminNotification, AdminOverview, DemoUser } from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { describe, expect, it } from "vitest";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const handlers = createHandlers(generateFixtures(SEN, 42, loadBoundaries("SEN")), {
  latency: [0, 0],
});

async function call(path: string, user?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept-Language", "en");
  if (user) headers.set("Authorization", `Bearer ${user}`);
  const response = await getResponse(
    handlers,
    new Request(`http://localhost/api/v1${path}`, { ...init, headers }),
  );
  if (!response) throw new Error(`No handler for ${path}`);
  return response;
}
const get = async <T>(path: string, user: string) => (await (await call(path, user)).json()) as T;

describe("admin mock", () => {
  it("lists demo users without a token, one per role and two admins", async () => {
    const users = (await (await call("/admin/demo-users")).json()) as DemoUser[];
    const roles = users.flatMap((user) => user.roles);
    for (const role of ["super_admin", "admin", "editor", "contributor", "reader"]) {
      expect(roles).toContain(role);
    }
    expect(roles.filter((role) => role === "admin")).toHaveLength(2);
  });

  it("refuses requests without a valid token", async () => {
    expect((await call("/admin/me")).status).toBe(401);
    expect((await call("/admin/me", "nobody")).status).toBe(401);
  });

  it("returns the user with localised organisations", async () => {
    const me = await get<AdminMe>("/admin/me", "u-contributor");
    expect(me.roles).toEqual(["contributor"]);
    expect(me.orgs.length).toBe(2);
    expect(typeof me.orgs[0]!.name).toBe("string");
  });

  it("scopes overview cards to the role", async () => {
    const editor = await get<AdminOverview>("/admin/overview", "u-editor");
    expect(editor.tasks.verify.length).toBeGreaterThan(0);
    expect(editor.tasks.approve).toEqual([]);
    expect(editor.tasks.verify.every((item) => item.status === "submitted")).toBe(true);

    const admin = await get<AdminOverview>("/admin/overview", "u-admin");
    expect(admin.tasks.approve.length).toBeGreaterThan(0);
    expect(admin.connectorFailures.length).toBe(1);
    expect(admin.usage).toHaveLength(30);

    const contributor = await get<AdminOverview>("/admin/overview", "u-contributor");
    expect(contributor.tasks.verify).toEqual([]);
    expect(contributor.connectorFailures).toEqual([]);
    expect(contributor.feedback).toEqual([]);
    expect(
      contributor.tasks.returned.every((item) => item.submittedBy.id === "u-contributor"),
    ).toBe(true);
  });

  it("limits the overview to one organisation with ?org=", async () => {
    const me = await get<AdminMe>("/admin/me", "u-admin");
    const org = me.orgs[0]!.code;
    const overview = await get<AdminOverview>(`/admin/overview?org=${org}`, "u-admin");
    expect(overview.deadlines.every((item) => item.org === org)).toBe(true);
  });

  it("shows public feedback in the admin overview", async () => {
    await call("/feedback", undefined, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5, message: "Admin test feedback", page: "/en" }),
    });
    const overview = await get<AdminOverview>("/admin/overview", "u-editor");
    expect(overview.feedback[0]!.message).toBe("Admin test feedback");
  });

  it("marks notifications read per user", async () => {
    const before = await get<AdminNotification[]>("/admin/notifications", "u-editor");
    expect(before.length).toBeGreaterThan(0);
    const id = before[0]!.id;
    await call("/admin/notifications/read", "u-editor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    const after = await get<AdminNotification[]>("/admin/notifications", "u-editor");
    expect(after.find((item) => item.id === id)?.read).toBe(true);
    const other = await get<AdminNotification[]>("/admin/notifications", "u-admin");
    expect(other.find((item) => item.id === id)?.read ?? false).toBe(false);
  });
});
