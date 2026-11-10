import type {
  AlertEvent,
  AlertRule,
  AlertRules,
  Campaign,
  CampaignOptions,
  CampaignPreview,
  CampaignSummary,
  Page,
  Problem,
  Subscriber,
} from "@onn/api-client/types";
import SEN from "@onn/config/countries/SEN";
import { getResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { audienceSize } from "./admin-outreach";
import { generateFixtures } from "./fixtures";
import { createHandlers } from "./handlers";
import { loadBoundaries } from "./load";

const handlers = createHandlers(generateFixtures(SEN, 42, loadBoundaries("SEN")), {
  latency: [0, 0],
  siteUrl: "https://onn.example",
});

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

afterEach(() => vi.useRealTimers());

describe("alerts", () => {
  it("lists the seeded rules with the people they can notify", async () => {
    const body = await json<AlertRules>(await call("/admin/alerts", "u-editor"));
    expect(body.rules.map((rule) => rule.condition)).toEqual([
      "threshold",
      "change",
      "off_track",
      "overdue",
      "anomaly",
    ]);
    expect(body.rules[0]!.indicatorName).not.toBe(body.rules[0]!.indicator);
    expect(body.rules[0]!.lastTriggered).toBeTruthy();
    expect(body.people.map((person) => person.id)).not.toContain("u-contributor");
    expect((await call("/admin/alerts", "u-contributor")).status).toBe(403);
  });

  it("checks what each condition needs", async () => {
    const base = {
      name: "Test",
      indicator: "CONN.4G_POP",
      recipients: ["u-admin"],
      channels: ["email"],
    };
    const errors = async (input: object) =>
      (
        (await json<Problem>(await call("/admin/alerts", "u-admin", { body: input }))).errors ?? []
      ).map((error) => `${error.path}:${error.message}`);
    expect(await errors({ ...base, condition: "threshold" })).toEqual([
      "value:required",
      "operator:required",
    ]);
    expect(await errors({ ...base, condition: "change", value: -5 })).toEqual(["value:positive"]);
    expect(
      await errors({ name: "", indicator: "NOPE", recipients: ["u-contributor"], channels: [] }),
    ).toEqual([
      "name:required",
      "indicator:unknown",
      "condition:required",
      "recipients:unknown",
      "channels:required",
    ]);
  });

  it("creates, edits and deletes a rule", async () => {
    const created = await call("/admin/alerts", "u-admin", {
      body: {
        name: "Fibre",
        indicator: "CONN.4G_POP",
        condition: "threshold",
        operator: "above",
        value: 90,
        recipients: ["u-admin", "u-admin"],
        channels: ["sms", "email"],
      },
    });
    expect(created.status).toBe(201);
    const rule = await json<AlertRule>(created);
    expect(rule).toMatchObject({ id: "AL-6", enabled: true, recipients: ["u-admin"] });
    expect(rule.channels).toEqual(["email", "sms"]);

    // Changing the condition drops the fields it no longer uses.
    const edited = await json<AlertRule>(
      await call("/admin/alerts/AL-6", "u-admin", {
        method: "PUT",
        body: { ...rule, condition: "overdue", enabled: false },
      }),
    );
    expect(edited.operator).toBeUndefined();
    expect(edited.value).toBeUndefined();
    expect(edited.enabled).toBe(false);

    expect((await call("/admin/alerts/AL-6", "u-admin", { method: "DELETE" })).status).toBe(200);
    expect((await call("/admin/alerts/AL-6", "u-admin")).status).toBe(404);
  });

  it("pages the event log and filters it by rule", async () => {
    const all = await json<Page<AlertEvent>>(await call("/admin/alerts/events", "u-editor"));
    expect(all.meta).toEqual({ total: 34, page: 1, pageSize: 25 });
    expect(all.items[0]!.date >= all.items[1]!.date).toBe(true);
    const one = await json<Page<AlertEvent>>(
      await call("/admin/alerts/events?rule=AL-1", "u-editor"),
    );
    expect(one.items.every((event) => event.rule === "AL-1" && event.unit)).toBe(true);
    expect(one.meta.total).toBe(7);
  });
});

describe("newsletter", () => {
  const draft = (items = [{ kind: "news", slug: "news-1" }]) => ({
    subject: { fr: "Essai", en: "Trial" },
    intro: { fr: "Bonjour <tous>" },
    items,
    audience: { locales: [], topics: [] },
  });

  it("lists past sends with their rates and offers published items", async () => {
    const list = await json<CampaignSummary[]>(await call("/admin/newsletter", "u-editor"));
    expect(list.map((item) => item.status)).toEqual(["draft", "sent", "sent"]);
    expect(list[0]!.openRate).toBeNull();
    expect(list[1]!.openRate).toBeGreaterThan(0.3);
    expect(list[1]!.clickRate).toBeLessThan(list[1]!.openRate!);
    const options = await json<CampaignOptions>(
      await call("/admin/newsletter/options", "u-editor"),
    );
    expect(options.choices.some((choice) => choice.kind === "publication")).toBe(true);
    expect(options.topics.length).toBeGreaterThan(3);
    expect((await call("/admin/newsletter", "u-reader")).status).toBe(403);
  });

  it("counts an audience by language and topic", () => {
    const subscribers: Subscriber[] = [
      { email: "a@x.org", locale: "fr", topics: [], status: "active", since: "2026-01-01" },
      { email: "b@x.org", locale: "en", topics: ["CONN"], status: "active", since: "2026-01-01" },
      { email: "c@x.org", locale: "fr", topics: ["GOV"], status: "active", since: "2026-01-01" },
      { email: "d@x.org", locale: "fr", topics: [], status: "unsubscribed", since: "2026-01-01" },
    ];
    expect(audienceSize(subscribers, { locales: [], topics: [] })).toBe(3);
    expect(audienceSize(subscribers, { locales: ["fr"], topics: [] })).toBe(2);
    // Someone who follows no topic gets everything.
    expect(audienceSize(subscribers, { locales: [], topics: ["CONN"] })).toBe(2);
  });

  it("previews unsaved content as an email in the chosen language", async () => {
    const preview = await json<CampaignPreview>(
      await call("/admin/newsletter/preview", "u-editor", {
        body: { campaign: { ...draft(), audience: { locales: ["en"], topics: [] } }, locale: "fr" },
      }),
    );
    expect(preview.subject).toBe("Essai");
    expect(preview.html).toContain("Bonjour &lt;tous&gt;");
    expect(preview.html).toContain('href="https://onn.example/fr/news/news-1"');
    expect(preview.recipients).toBeGreaterThan(0);
    expect(preview.recipients).toBeLessThan(30);
  });

  it("refuses an empty or unknown selection", async () => {
    const errors = async (input: object) =>
      (
        (await json<Problem>(await call("/admin/newsletter", "u-editor", { body: input })))
          .errors ?? []
      ).map((error) => `${error.path}:${error.message}`);
    expect(await errors({ subject: { en: "x" }, items: [] })).toEqual([
      "subject.fr:required",
      "items:required",
    ]);
    expect(
      await errors({
        ...draft([{ kind: "news", slug: "nope" }]),
        audience: { locales: ["de"], topics: ["NOPE"] },
      }),
    ).toEqual(["items:unknown", "audience.locales:unknown", "audience.topics:unknown"]);
  });

  it("sends a draft once, to the audience it matched", async () => {
    const created = await json<Campaign>(
      await call("/admin/newsletter", "u-editor", { body: draft() }),
    );
    expect(created).toMatchObject({ id: "NL-4", status: "draft" });
    const sent = await json<Campaign>(
      await call("/admin/newsletter/NL-4/send", "u-editor", { body: {} }),
    );
    expect(sent.status).toBe("sent");
    expect(sent.recipients).toBe(created.recipients);

    // A later sign-up doesn't change who received it, and a sent newsletter is closed.
    await call("/subscribers", null, { body: { email: "New@Example.org", locale: "en" } });
    expect(
      (await json<Campaign>(await call("/admin/newsletter/NL-4", "u-editor"))).recipients,
    ).toBe(sent.recipients);
    expect(
      (await call("/admin/newsletter/NL-4", "u-editor", { method: "PUT", body: draft() })).status,
    ).toBe(409);
    expect((await call("/admin/newsletter/NL-4/send", "u-editor", { body: {} })).status).toBe(409);
  });

  it("schedules, cancels and sends on time", async () => {
    vi.useFakeTimers({ now: new Date("2026-06-01T08:00:00Z"), toFake: ["Date"] });
    const created = await json<Campaign>(
      await call("/admin/newsletter", "u-editor", { body: draft() }),
    );
    const path = `/admin/newsletter/${created.id}`;
    const scheduled = await json<Campaign>(
      await call(`${path}/send`, "u-editor", { body: { at: "2026-06-03T09:00:00Z" } }),
    );
    expect(scheduled).toMatchObject({ status: "scheduled", sendAt: "2026-06-03T09:00:00.000Z" });
    expect(
      (await json<Campaign>(await call(`${path}/unschedule`, "u-editor", { body: {} }))).status,
    ).toBe("draft");

    await call(`${path}/send`, "u-editor", { body: { at: "2026-06-03T09:00:00Z" } });
    vi.setSystemTime(new Date("2026-06-03T09:00:01Z"));
    const after = await json<Campaign>(await call(path, "u-editor"));
    expect(after).toMatchObject({ status: "sent", sentAt: "2026-06-03T09:00:00.000Z" });
    expect(after.sendAt).toBeUndefined();
  });

  it("lists subscribers, including one who signs up on the portal", async () => {
    const before = await json<Page<Subscriber>>(
      await call("/admin/newsletter/subscribers?pageSize=100", "u-editor"),
    );
    expect(
      (await call("/subscribers", null, { body: { email: "not-an-email", locale: "fr" } })).status,
    ).toBe(422);
    await call("/subscribers", null, {
      body: { email: "Lecteur@Example.org", locale: "en", topics: ["CONN", "NOPE"] },
    });
    const found = await json<Page<Subscriber>>(
      await call("/admin/newsletter/subscribers?q=lecteur", "u-editor"),
    );
    expect(found.items).toEqual([
      expect.objectContaining({
        email: "lecteur@example.org",
        locale: "en",
        topics: ["CONN"],
        status: "active",
      }),
    ]);
    const after = await json<Page<Subscriber>>(
      await call("/admin/newsletter/subscribers?status=active", "u-editor"),
    );
    expect(after.meta.total).toBeGreaterThan(
      before.items.filter((item) => item.status === "active").length,
    );
    const unsubscribed = await json<Page<Subscriber>>(
      await call("/admin/newsletter/subscribers?status=unsubscribed&locale=fr", "u-editor"),
    );
    expect(unsubscribed.items.every((item) => item.status === "unsubscribed")).toBe(true);
  });
});
