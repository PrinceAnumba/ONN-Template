import type {
  AdminUser,
  AuditPage,
  AuditVerification,
  ChannelTest,
  DemoUser,
  FeedbackPage,
  OrganisationAdmin,
  OrganisationAdminSummary,
  Problem,
  SettingsAdmin,
  UserPage,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { describe, expect, it } from "vitest";
import { recordAudit, verifyChain, type StoredAudit } from "./admin-governance";
import { buildAdminState } from "./admin-seed";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const fixtures = () => generateFixtures(SEN, 42, loadBoundaries("SEN"));
const handlers = createHandlers(fixtures(), { latency: [0, 0] });

async function call(
  path: string,
  user: string | null,
  init: { method?: string; body?: unknown } = {},
) {
  const headers = new Headers({ "Accept-Language": "en" });
  if (user) headers.set("Authorization", `Bearer ${user}`);
  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.body);
  }
  const response = await getResponse(
    handlers,
    new Request(`http://localhost/api/v1${path}`, {
      method: init.method ?? (body ? "POST" : "GET"),
      headers,
      body,
    }),
  );
  if (!response) throw new Error(`No handler for ${path}`);
  return response;
}
const json = async <T>(response: Response) => (await response.json()) as T;
const latest = async () => (await json<AuditPage>(await call("/admin/audit", "u-super"))).items[0]!;

describe("users", () => {
  it("lists users with counts per status, for admins only", async () => {
    const body = await json<UserPage>(await call("/admin/users", "u-admin"));
    expect(body.counts).toEqual({ active: 6, invited: 2, deactivated: 1 });
    expect(body.items).toHaveLength(9);
    expect(body.orgs.length).toBeGreaterThan(0);
    const invited = await json<UserPage>(await call("/admin/users?status=invited", "u-admin"));
    expect(invited.items.every((user) => user.status === "invited" && !user.lastLogin)).toBe(true);
    expect(invited.counts.active).toBe(6);
    const found = await json<UserPage>(await call("/admin/users?q=moreau", "u-admin"));
    expect(found.items.map((user) => user.id)).toEqual(["u-admin"]);
    expect((await call("/admin/users", "u-editor")).status).toBe(403);
  });

  it("invites a user and refuses bad input", async () => {
    const { orgs } = await json<UserPage>(await call("/admin/users", "u-admin"));
    const bad = await call("/admin/users", "u-admin", {
      body: { name: "", email: "admin@example.org", role: "owner", orgs: [] },
    });
    expect(bad.status).toBe(422);
    expect((await json<Problem>(bad)).errors).toEqual([
      { path: "name", message: "required" },
      { path: "email", message: "duplicate" },
      { path: "role", message: "unknown" },
      { path: "orgs", message: "required" },
    ]);
    const created = await call("/admin/users", "u-admin", {
      body: { name: "Noa Test", email: "Noa@Example.org", role: "editor", orgs: [orgs[0]!.code] },
    });
    expect(created.status).toBe(201);
    const user = await json<AdminUser>(created);
    expect(user).toMatchObject({ email: "noa@example.org", status: "invited", mfa: false });
    // Not offered for sign-in until the invitation is accepted.
    const demo = await json<DemoUser[]>(await call("/admin/demo-users", null));
    expect(demo.map((item) => item.id)).not.toContain(user.id);
    expect(await latest()).toMatchObject({ action: "invite", entity: "user", entityId: user.id });
  });

  it("keeps the super admin role to super admins and stops self-harm", async () => {
    const { orgs } = await json<UserPage>(await call("/admin/users", "u-admin"));
    const body = { name: "Sam Martin", role: "admin", orgs: [orgs[0]!.code] };
    const refused = await call("/admin/users/u-super", "u-admin", { method: "PUT", body });
    expect(refused.status).toBe(403);
    expect((await json<Problem>(refused)).type).toBe("role");
    const own = await call("/admin/users/u-admin", "u-admin", {
      method: "PUT",
      body: { ...body, name: "Alex Moreau", role: "editor" },
    });
    expect((await json<Problem>(own)).type).toBe("self");
    const self = await call("/admin/users/u-admin/deactivate", "u-admin", { method: "POST" });
    expect((await json<Problem>(self)).type).toBe("self");
  });

  it("deactivates, which signs the user out, and reactivates", async () => {
    const off = await json<AdminUser>(
      await call("/admin/users/u-reader/deactivate", "u-admin", { method: "POST" }),
    );
    expect(off.status).toBe("deactivated");
    expect((await call("/admin/me", "u-reader")).status).toBe(401);
    expect(await latest()).toMatchObject({
      action: "deactivate",
      before: { status: "active" },
      after: { status: "deactivated" },
    });
    const again = await call("/admin/users/u-reader/deactivate", "u-admin", { method: "POST" });
    expect((await json<Problem>(again)).type).toBe("state");
    const on = await json<AdminUser>(
      await call("/admin/users/u-reader/reactivate", "u-admin", { method: "POST" }),
    );
    expect(on.status).toBe("active");
    expect((await call("/admin/me", "u-reader")).status).toBe(200);
  });

  it("exports the access review as CSV", async () => {
    const response = await call("/admin/users/access-review", "u-admin");
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("access-review-");
    const lines = (await response.text()).trim().split("\r\n");
    expect(lines[0]).toContain("name,email,roles,organisations,status,mfa,last_login");
    expect(lines.length).toBeGreaterThanOrEqual(10);
  });
});

describe("organisations", () => {
  it("lists organisations and shows what each one reports", async () => {
    const list = await json<OrganisationAdminSummary[]>(
      await call("/admin/organisations", "u-admin"),
    );
    expect(list.length).toBeGreaterThan(1);
    const first = list.find((org) => org.indicators > 0)!;
    const detail = await json<OrganisationAdmin>(
      await call(`/admin/organisations/${first.code}`, "u-admin"),
    );
    expect(detail.indicators).toHaveLength(first.indicators);
    expect(detail.contacts[0]!.email).toContain("@");
    expect(detail.name.fr).toBeTruthy();
    expect((await call("/admin/organisations", "u-editor")).status).toBe(403);
  });

  it("saves the profile and contacts, with field errors", async () => {
    const [org] = await json<OrganisationAdminSummary[]>(
      await call("/admin/organisations", "u-admin"),
    );
    const path = `/admin/organisations/${org!.code}`;
    const before = await json<OrganisationAdmin>(await call(path, "u-admin"));
    const bad = await call(path, "u-admin", {
      method: "PUT",
      body: {
        name: { en: "Only English" },
        kind: "club",
        website: "example.org",
        contacts: [{ name: "", email: "nope", phone: "x" }],
      },
    });
    expect((await json<Problem>(bad)).errors?.map((error) => error.path)).toEqual([
      "name.fr",
      "kind",
      "website",
      "contacts.0.name",
      "contacts.0.email",
      "contacts.0.phone",
    ]);
    const saved = await json<OrganisationAdmin>(
      await call(path, "u-admin", {
        method: "PUT",
        body: {
          ...before,
          name: { ...before.name, fr: "Agence renommée" },
          contacts: [...before.contacts, { name: "Kim Ba", role: "", email: "kim@example.org" }],
        },
      }),
    );
    expect(saved.contacts).toHaveLength(before.contacts.length + 1);
    // The new name shows wherever the organisation is named.
    const me = await json<{ orgs: { code: string; name: string }[] }>(
      await call("/admin/me", "u-admin", {}),
    );
    expect(me.orgs.find((item) => item.code === org!.code)).toBeTruthy();
    const entry = await latest();
    expect(entry).toMatchObject({ action: "update", entity: "organisation", entityId: org!.code });
    expect((entry.after as { name: { fr: string } }).name.fr).toBe("Agence renommée");
  });
});

describe("feedback inbox", () => {
  it("filters by status, rating and text, and keeps the sender's email", async () => {
    await call("/feedback", null, {
      body: { rating: 2, message: "Lien cassé zzz", email: "visitor@example.org", page: "/fr/map" },
    });
    const all = await json<FeedbackPage>(await call("/admin/feedback", "u-editor"));
    expect(all.meta.total).toBe(9);
    expect(all.items[0]).toMatchObject({ email: "visitor@example.org", status: "new" });
    expect(all.counts.new).toBe(4);
    const found = await json<FeedbackPage>(
      await call("/admin/feedback?q=zzz&rating=2", "u-editor"),
    );
    expect(found.items).toHaveLength(1);
    const done = await json<FeedbackPage>(await call("/admin/feedback?status=done", "u-editor"));
    expect(done.items.every((item) => item.status === "done")).toBe(true);
    expect((await call("/admin/feedback", "u-contributor")).status).toBe(403);
  });

  it("changes status one at a time and in bulk", async () => {
    const { items } = await json<FeedbackPage>(
      await call("/admin/feedback?status=new", "u-editor"),
    );
    const one = await call(`/admin/feedback/${items[0]!.id}`, "u-editor", {
      method: "PATCH",
      body: { status: "planned", note: "Dans le prochain lot" },
    });
    expect(await json(one)).toMatchObject({ status: "planned", note: "Dans le prochain lot" });
    const bad = await call(`/admin/feedback/${items[0]!.id}`, "u-editor", {
      method: "PATCH",
      body: { status: "closed" },
    });
    expect(bad.status).toBe(422);
    const bulk = await json<{ done: string[]; failed: { id: string }[] }>(
      await call("/admin/feedback/bulk", "u-editor", {
        body: { ids: [items[1]!.id, "FB-9999"], status: "wont_do" },
      }),
    );
    expect(bulk.done).toEqual([items[1]!.id]);
    expect(bulk.failed.map((item) => item.id)).toEqual(["FB-9999"]);
    const after = await json<FeedbackPage>(await call("/admin/feedback", "u-editor"));
    expect(after.counts.wont_do).toBe(1);
  });
});

describe("audit log", () => {
  it("starts with a chain that verifies, newest first", async () => {
    const body = await json<AuditPage>(await call("/admin/audit", "u-admin"));
    expect(body.meta.total).toBeGreaterThan(30);
    expect(body.items[0]!.seq).toBeGreaterThan(body.items[1]!.seq);
    expect(body.items[0]!.prevHash).toBe(body.items[1]!.hash);
    expect(body.actors.length).toBeGreaterThan(1);
    const check = await json<AuditVerification>(
      await call("/admin/audit/verify", "u-admin", { method: "POST" }),
    );
    expect(check).toMatchObject({ ok: true, checked: body.meta.total });
    expect((await call("/admin/audit", "u-editor")).status).toBe(403);
  });

  it("filters by actor, entity, action and date", async () => {
    const body = await json<AuditPage>(
      await call("/admin/audit?entity=submission&action=transition", "u-admin"),
    );
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.entity === "submission")).toBe(true);
    const actor = body.items[0]!.actor.id;
    const mine = await json<AuditPage>(await call(`/admin/audit?actor=${actor}`, "u-admin"));
    expect(mine.items.every((item) => item.actor.id === actor)).toBe(true);
    const none = await json<AuditPage>(await call("/admin/audit?to=1999-01-01", "u-admin"));
    expect(none.meta.total).toBe(0);
  });

  it("records writes from other screens, but not previews or reads", async () => {
    const before = (await json<AuditPage>(await call("/admin/audit", "u-admin"))).meta.total;
    await call("/admin/alerts", "u-editor");
    await call("/admin/newsletter/preview", "u-editor", { body: {} });
    const created = await call("/admin/alerts", "u-editor", {
      body: {
        name: "Audit test",
        indicator: fixtures().indicators[0]!.code,
        condition: "overdue",
        recipients: ["u-admin"],
        channels: ["email"],
        enabled: true,
      },
    });
    expect(created.status).toBe(201);
    const after = await json<AuditPage>(await call("/admin/audit", "u-admin"));
    expect(after.meta.total).toBe(before + 1);
    expect(after.items[0]).toMatchObject({
      action: "create",
      entity: "alert",
      actor: { id: "u-editor" },
    });
    expect(after.items[0]!.entityId).toMatch(/^AL-/);
  });

  it("finds the first entry that was changed", () => {
    const state = buildAdminState(fixtures());
    recordAudit(state, { actor: "u-admin", action: "delete", entity: "alert", entityId: "AL-1" });
    const log: StoredAudit[] = state.governance.audit;
    expect(verifyChain(log)).toEqual({ ok: true, checked: log.length });
    log[4] = { ...log[4]!, entityId: "tampered" };
    expect(verifyChain(log)).toEqual({ ok: false, checked: log.length, brokenAt: log[4]!.seq });
  });
});

describe("settings", () => {
  it("is for super admins only", async () => {
    expect((await call("/admin/settings", "u-admin")).status).toBe(403);
    const body = await json<SettingsAdmin>(await call("/admin/settings", "u-super"));
    expect(body.overrides).toMatchObject({ contactEmail: null, sessionMinutes: "60" });
    expect(body.defaults.sessionMinutes).toBe("30");
    expect(body.quotas.map((quota) => quota.tier)).toEqual(["anonymous", "registered", "partner"]);
    expect(body.updatedBy).toBe("Sam Martin");
  });

  it("validates and saves overrides, toggles and quotas", async () => {
    const current = await json<SettingsAdmin>(await call("/admin/settings", "u-super"));
    const bad = await call("/admin/settings", "u-super", {
      method: "PUT",
      body: {
        overrides: {
          contactEmail: "nope",
          exportMaxRows: "12",
          sessionMinutes: "",
          cacheSeconds: "x",
        },
        features: current.features,
        quotas: [
          { tier: "anonymous", perMinute: 100, perDay: 50 },
          { tier: "registered", perMinute: 0, perDay: 10 },
          { tier: "partner", perMinute: 10, perDay: 100 },
        ],
      },
    });
    expect((await json<Problem>(bad)).errors).toEqual([
      { path: "overrides.contactEmail", message: "email" },
      { path: "overrides.exportMaxRows", message: "range" },
      { path: "overrides.cacheSeconds", message: "range" },
      { path: "quotas.0.perDay", message: "order" },
      { path: "quotas.1.perMinute", message: "range" },
    ]);
    const saved = await json<SettingsAdmin>(
      await call("/admin/settings", "u-super", {
        method: "PUT",
        body: {
          overrides: { ...current.overrides, sessionMinutes: "", cacheSeconds: "120" },
          features: { ...current.features, chatbot: true },
          quotas: current.quotas,
        },
      }),
    );
    expect(saved.overrides).toMatchObject({ sessionMinutes: null, cacheSeconds: "120" });
    expect(saved.features.chatbot).toBe(true);
    const entry = await latest();
    expect(entry).toMatchObject({ entity: "settings", action: "update" });
    expect((entry.before as SettingsAdmin).features.chatbot).toBe(false);
  });

  it("tests the email and SMS gateways", async () => {
    const logged = (await latest()).seq;
    const ok = await json<ChannelTest>(
      await call("/admin/settings/test/smtp", "u-super", { body: { to: "me@example.org" } }),
    );
    expect(ok.ok).toBe(true);
    const failed = await json<ChannelTest>(
      await call("/admin/settings/test/sms", "u-super", { body: { to: "+221 77 000 0000" } }),
    );
    expect(failed).toMatchObject({ ok: false, detail: expect.stringContaining("21211") });
    const bad = await call("/admin/settings/test/smtp", "u-super", { body: { to: "nope" } });
    expect((await json<Problem>(bad)).errors).toEqual([{ path: "to", message: "email" }]);
    const body = await json<SettingsAdmin>(await call("/admin/settings", "u-super"));
    expect(body.smtp.lastTest?.ok).toBe(true);
    expect(body.sms.lastTest?.ok).toBe(false);
    // Tests aren't changes, so they leave the audit log alone.
    expect((await latest()).seq).toBe(logged);
  });
});
