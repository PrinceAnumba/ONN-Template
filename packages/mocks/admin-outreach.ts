// Back-office mock for Phase 7f (brief §7): alert rules with their event log, and the newsletter
// (campaigns, audience, preview, subscribers). Nothing is really sent: sending records who would
// have received it, and the preview is a stand-in for the backend's email template.
import { can } from "@onn/api-client/permissions";
import type {
  AlertChannel,
  AlertCondition,
  AlertEvent,
  AlertRule,
  AlertRuleInput,
  AlertRules,
  Campaign,
  CampaignAudience,
  CampaignChoice,
  CampaignInput,
  CampaignItem,
  CampaignOptions,
  CampaignPreview,
  CampaignStatus,
  CampaignSummary,
  Page,
  Subscriber,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type { RouteContext } from "./admin";
import type { AdminState, StoredUser } from "./admin-seed";
import { createRandom, type Fixtures } from "./fixtures";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Text = Record<string, string>;
type FieldError = { path: string; message: string };

export interface StoredRule extends AlertRuleInput {
  id: string;
  lastTriggered?: string;
  updated: string;
}

export type StoredEvent = Omit<AlertEvent, "indicatorName" | "unit">;

export interface StoredCampaign extends CampaignInput {
  id: string;
  status: CampaignStatus;
  sendAt?: string;
  sentAt?: string;
  /** Fixed once sent. */
  recipients?: number;
  opens: number;
  clicks: number;
  updated: string;
}

export interface OutreachState {
  rules: StoredRule[];
  events: StoredEvent[];
  campaigns: StoredCampaign[];
  subscribers: Subscriber[];
}

export interface OutreachDeps {
  authed: (
    method: Method,
    path: string,
    resolver: (ctx: RouteContext & { user: StoredUser }) => Response | Promise<Response>,
  ) => RequestHandler;
  localise: <T>(value: unknown, locale: string) => T;
  problem: (status: number, title: string, detail?: string) => Response;
  state: AdminState;
  locales: string[];
  defaultLocale: string;
  indicatorCodes: () => string[];
  /** Stored name and unit of an indicator (localised per request). */
  indicator: (code: string) => { name: unknown; unit: unknown } | undefined;
  pillars: { code: string; name: unknown }[];
  /** The public stores: a newsletter is composed from what the portal shows. */
  publicNews: Fixtures["news"];
  publicPublications: Fixtures["publications"];
  /** Where email links point; empty gives site-relative links. */
  siteUrl: string;
}

const DAY = 24 * 60 * 60 * 1000;
const CONDITIONS: AlertCondition[] = ["threshold", "change", "off_track", "overdue", "anomaly"];
const CHANNELS: AlertChannel[] = ["email", "sms", "in_app"];
const PAGE_SIZES = [25, 50, 100];
const MAX_ITEMS = 12;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Seeded campaign and email wording, in the default language (stored content, not UI text). */
const WORDS: Record<
  string,
  Record<"monthly" | "intro" | "draft" | "read" | "footer" | "publication", string>
> = {
  fr: {
    monthly: "Lettre d'information",
    intro: "Les nouveautés de l'observatoire ce mois-ci.",
    draft: "Prochaine lettre (brouillon)",
    read: "Lire la suite",
    footer: "Vous recevez ce message car vous êtes abonné à la lettre d'information.",
    publication: "Publication",
  },
  en: {
    monthly: "Newsletter",
    intro: "What's new at the observatory this month.",
    draft: "Next newsletter (draft)",
    read: "Read more",
    footer: "You receive this message because you subscribed to the newsletter.",
    publication: "Publication",
  },
};

const invalid = (errors: FieldError[]) =>
  HttpResponse.json(
    { type: "validation", title: "Invalid", status: 422, errors },
    { status: 422, headers: { "Content-Type": "application/problem+json" } },
  );
const typed = (status: number, type: string, title: string) =>
  HttpResponse.json(
    { type, title, status },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
const clone = <T>(value: T): T => structuredClone(value);
const escapeHtml = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const cleanText = (value: unknown, locales: string[]): Text =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        locales
          .filter((locale) => String((value as Text)[locale] ?? "").trim())
          .map((locale) => [locale, String((value as Text)[locale])]),
      )
    : {};

/** Subscribers an audience reaches: empty lists mean everyone, and so does following no topic. */
export function audienceSize(subscribers: Subscriber[], audience: CampaignAudience) {
  return subscribers.filter(
    (item) =>
      item.status === "active" &&
      (audience.locales.length === 0 || audience.locales.includes(item.locale)) &&
      (audience.topics.length === 0 ||
        item.topics.length === 0 ||
        item.topics.some((topic) => audience.topics.includes(topic))),
  ).length;
}

export function seedOutreach(data: Fixtures, users: StoredUser[], now: Date): OutreachState {
  const random = createRandom(11);
  const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const { locales, defaultLocale } = data.meta;
  const words = WORDS[defaultLocale] ?? WORDS.en!;
  const published = data.indicators.filter((item) => item.status === "published");
  const headline = published.filter((item) => item.isHeadline).map((item) => item.code as string);
  const codes = headline.length >= 4 ? headline : published.map((item) => item.code as string);
  const editors = users.filter((user) => can(user.roles, "alert.manage")).map((user) => user.id);
  const admin = users.find((user) => user.roles.includes("admin"))?.id ?? users[0]!.id;
  const editor = users.find((user) => user.roles.includes("editor"))?.id ?? admin;

  const rule = (
    index: number,
    input: Omit<AlertRuleInput, "indicator" | "enabled"> & { enabled?: boolean },
  ): StoredRule => ({
    id: `AL-${index + 1}`,
    indicator: codes[index % codes.length] ?? "",
    enabled: true,
    ...input,
    updated: ago(30 - index * 4),
  });
  // Rule names are data an editor typed, so they stay in one language.
  const french = defaultLocale === "fr";
  const rules: StoredRule[] = [
    rule(0, {
      name: french ? "Couverture sous le seuil" : "Coverage under the threshold",
      condition: "threshold",
      operator: "below",
      value: 80,
      recipients: [admin, editor],
      channels: ["email", "in_app"],
    }),
    rule(1, {
      name: french ? "Variation forte d'une période à l'autre" : "Sharp change between periods",
      condition: "change",
      value: 15,
      recipients: [editor],
      channels: ["email"],
    }),
    rule(2, {
      name: french ? "Cible 2030 hors trajectoire" : "2030 target off track",
      condition: "off_track",
      recipients: [admin],
      channels: ["email", "sms"],
    }),
    rule(3, {
      name: french ? "Collecte en retard" : "Collection overdue",
      condition: "overdue",
      recipients: editors.slice(0, 3),
      channels: ["in_app"],
    }),
    rule(4, {
      name: french ? "Valeur inhabituelle" : "Unusual value",
      condition: "anomaly",
      recipients: [editor],
      channels: ["email"],
      enabled: false,
    }),
  ];

  const year = now.getUTCFullYear() - 1;
  const events: StoredEvent[] = Array.from({ length: 34 }, (_, index) => {
    const source = rules[index % rules.length]!;
    const valued = source.condition === "threshold" || source.condition === "change";
    return {
      id: `EV-${String(34 - index).padStart(3, "0")}`,
      rule: source.id,
      ruleName: source.name,
      indicator: source.indicator,
      condition: source.condition,
      date: ago(index * 1.7 + random()),
      ...(valued
        ? {
            value:
              source.condition === "threshold"
                ? Math.round((60 + random() * 19) * 10) / 10
                : Math.round((15 + random() * 20) * 10) / 10,
            period: String(year - (index % 2)),
          }
        : {}),
      channels: source.channels,
      recipients: source.recipients.length,
      status: index % 9 === 4 ? "failed" : "sent",
    };
  });
  for (const item of rules) {
    item.lastTriggered = events.find((event) => event.rule === item.id)?.date;
  }

  const pillars = data.pillars.map((pillar) => pillar.code);
  const subscribers: Subscriber[] = Array.from({ length: 64 }, (_, index) => ({
    email: `abonne${String(index + 1).padStart(2, "0")}@example.org`,
    locale: locales[index % 5 === 0 ? 1 % locales.length : 0] ?? defaultLocale,
    topics:
      index % 3 === 0
        ? []
        : [pillars[index % pillars.length], pillars[(index * 2 + 1) % pillars.length]]
            .filter((code): code is string => Boolean(code))
            .filter((code, position, list) => list.indexOf(code) === position),
    status: index % 11 === 7 ? "unsubscribed" : "active",
    since: ago(index * 5.5 + 2).slice(0, 10),
  }));

  const newest = [...data.news]
    .filter((item) => item.kind === "news")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const items = (from: number): CampaignItem[] => [
    ...newest
      .slice(from, from + 3)
      .map((item) => ({ kind: "news" as const, slug: item.slug as string })),
    ...data.publications
      .slice(from / 3, from / 3 + 1)
      .map((item) => ({ kind: "publication" as const, slug: item.slug as string })),
  ];
  const all = { locales: [], topics: [] };
  const sent = (index: number, days: number): StoredCampaign => {
    const recipients = audienceSize(subscribers, all) - index * 3;
    return {
      id: `NL-${index + 1}`,
      subject: { [defaultLocale]: `${words.monthly} n° ${index + 1}` },
      intro: { [defaultLocale]: words.intro },
      items: items(index * 3),
      audience: all,
      status: "sent",
      sentAt: ago(days),
      recipients,
      opens: Math.round(recipients * (0.38 + random() * 0.15)),
      clicks: Math.round(recipients * (0.08 + random() * 0.07)),
      updated: ago(days),
    };
  };
  const campaigns: StoredCampaign[] = [
    sent(0, 62),
    sent(1, 31),
    {
      id: "NL-3",
      subject: { [defaultLocale]: words.draft },
      intro: { [defaultLocale]: words.intro },
      items: items(0),
      audience: all,
      status: "draft",
      opens: 0,
      clicks: 0,
      updated: ago(1),
    },
  ];
  return { rules, events, campaigns, subscribers };
}

export function createOutreachHandlers(deps: OutreachDeps) {
  const { authed, localise, problem, state, locales, defaultLocale } = deps;
  const outreach = state.outreach;
  const now = () => new Date().toISOString();
  const pick = (value: Text | undefined, locale: string) =>
    value?.[locale] || value?.[defaultLocale] || Object.values(value ?? {})[0] || "";
  const paged = <T>(rows: T[], q: URLSearchParams): Page<T> => {
    const requested = Number(q.get("pageSize"));
    const pageSize = PAGE_SIZES.includes(requested) ? requested : PAGE_SIZES[0]!;
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const page = Math.min(Math.max(1, Number(q.get("page")) || 1), pages);
    return {
      items: rows.slice((page - 1) * pageSize, page * pageSize),
      meta: { total: rows.length, page, pageSize },
    };
  };

  // ---- Alerts ----
  const alertGuard = (user: StoredUser) => can(user.roles, "alert.manage");
  const alertForbidden = () => typed(403, "role", "Your role can't manage alerts");
  const people = () =>
    state.users
      .filter((user) => user.active && can(user.roles, "usage.view"))
      .map((user) => ({ id: user.id, name: user.name }));
  const indicatorName = (code: string, locale: string) => {
    const found = deps.indicator(code);
    return found ? localise<string>(found.name, locale) : code;
  };
  const ruleOut = (item: StoredRule, locale: string): AlertRule => ({
    ...clone(item),
    indicatorName: indicatorName(item.indicator, locale),
  });
  const findRule = (id: string) => outreach.rules.find((item) => item.id === id);
  const ruleErrors = (input: Partial<AlertRuleInput>) => {
    const errors: FieldError[] = [];
    const at = (path: string, message: string) => errors.push({ path, message });
    const name = String(input.name ?? "").trim();
    if (!name) at("name", "required");
    else if (name.length > 80) at("name", "length");
    const indicator = String(input.indicator ?? "");
    if (!indicator) at("indicator", "required");
    else if (!deps.indicatorCodes().includes(indicator)) at("indicator", "unknown");
    const condition = CONDITIONS.find((item) => item === input.condition);
    if (!condition) at("condition", input.condition ? "unknown" : "required");
    const value: Pick<AlertRuleInput, "operator" | "value"> = {};
    if (condition === "threshold" || condition === "change") {
      if (typeof input.value !== "number" || !Number.isFinite(input.value)) at("value", "required");
      else if (condition === "change" && input.value <= 0) at("value", "positive");
      else value.value = input.value;
    }
    if (condition === "threshold") {
      if (input.operator !== "above" && input.operator !== "below") at("operator", "required");
      else value.operator = input.operator;
    }
    const known = new Set(people().map((person) => person.id));
    const recipients = [
      ...new Set((Array.isArray(input.recipients) ? input.recipients : []).map(String)),
    ];
    if (recipients.length === 0) at("recipients", "required");
    else if (recipients.some((id) => !known.has(id))) at("recipients", "unknown");
    const channels = CHANNELS.filter((channel) =>
      (Array.isArray(input.channels) ? input.channels : []).includes(channel),
    );
    if (channels.length === 0) at("channels", "required");
    return {
      errors,
      value: {
        name,
        indicator,
        condition: condition ?? "threshold",
        ...value,
        recipients,
        channels,
        enabled: input.enabled !== false,
      } satisfies AlertRuleInput,
    };
  };

  // ---- Newsletter ----
  const letterGuard = (user: StoredUser) => can(user.roles, "newsletter.manage");
  const letterForbidden = () => typed(403, "role", "Your role can't manage the newsletter");
  const findCampaign = (id: string) => outreach.campaigns.find((item) => item.id === id);
  /** Scheduled newsletters go out when their time has come (checked on each request). */
  const settle = () => {
    const time = Date.now();
    for (const item of outreach.campaigns) {
      if (item.status === "scheduled" && item.sendAt && Date.parse(item.sendAt) <= time) {
        item.status = "sent";
        item.sentAt = item.sendAt;
        delete item.sendAt;
        item.recipients = audienceSize(outreach.subscribers, item.audience);
      }
    }
  };
  const reach = (item: StoredCampaign) =>
    item.recipients ?? audienceSize(outreach.subscribers, item.audience);
  const campaignOut = (item: StoredCampaign): Campaign => ({
    ...clone(item),
    recipients: reach(item),
  });
  const choices = (locale: string): CampaignChoice[] =>
    [
      ...deps.publicNews.map((item) => ({
        kind: "news" as const,
        slug: item.slug as string,
        title: localise<string>(item.title, locale),
        date: item.date as string,
      })),
      ...deps.publicPublications.map((item) => ({
        kind: "publication" as const,
        slug: item.slug as string,
        title: localise<string>(item.title, locale),
        date: item.date as string,
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  const campaignErrors = (input: Partial<CampaignInput>) => {
    const errors: FieldError[] = [];
    const subject = cleanText(input.subject, locales);
    if (!subject[defaultLocale])
      errors.push({ path: `subject.${defaultLocale}`, message: "required" });
    else if (Object.values(subject).some((text) => text.length > 120))
      errors.push({ path: `subject.${defaultLocale}`, message: "length" });
    const available = new Set(choices(defaultLocale).map((item) => `${item.kind}:${item.slug}`));
    const seen = new Set<string>();
    const items = (Array.isArray(input.items) ? input.items : []).map((raw) => {
      const item = (raw ?? {}) as CampaignItem;
      return {
        kind: item.kind === "publication" ? item.kind : ("news" as const),
        slug: String(item.slug ?? ""),
      };
    });
    if (items.length === 0) errors.push({ path: "items", message: "required" });
    else if (items.length > MAX_ITEMS) errors.push({ path: "items", message: "count" });
    else {
      for (const item of items) {
        const key = `${item.kind}:${item.slug}`;
        if (!available.has(key) || seen.has(key)) {
          errors.push({ path: "items", message: seen.has(key) ? "duplicate" : "unknown" });
          break;
        }
        seen.add(key);
      }
    }
    const audience = (input.audience ?? {}) as Partial<CampaignAudience>;
    const audienceLocales = (Array.isArray(audience.locales) ? audience.locales : []).map(String);
    if (audienceLocales.some((locale) => !locales.includes(locale)))
      errors.push({ path: "audience.locales", message: "unknown" });
    const topics = (Array.isArray(audience.topics) ? audience.topics : []).map(String);
    if (topics.some((topic) => !deps.pillars.some((pillar) => pillar.code === topic)))
      errors.push({ path: "audience.topics", message: "unknown" });
    return {
      errors,
      value: {
        subject,
        intro: cleanText(input.intro, locales),
        items,
        audience: { locales: audienceLocales, topics },
      } satisfies CampaignInput,
    };
  };
  /** A plain stand-in for the backend's email template. */
  const email = (input: CampaignInput, locale: string): string => {
    const words = WORDS[locale] ?? WORDS[defaultLocale] ?? WORDS.en!;
    const link = (item: CampaignItem) =>
      `${deps.siteUrl}/${locale}/${item.kind === "news" ? "news" : "publications"}/${item.slug}`;
    const blocks = input.items
      .map((item) => {
        const store = item.kind === "news" ? deps.publicNews : deps.publicPublications;
        const found = store.find((entry) => entry.slug === item.slug) as
          Record<string, unknown> | undefined;
        if (!found) return "";
        const title = localise<string>(found.title, locale);
        const text = localise<string>(found.excerpt ?? found.summary ?? "", locale);
        return `<tr><td style="padding:16px 24px;border-top:1px solid #d9dee4">${
          item.kind === "publication"
            ? `<p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;color:#4a5560">${escapeHtml(words.publication)}</p>`
            : ""
        }<h2 style="margin:0 0 8px;font-size:18px;line-height:1.3">${escapeHtml(title)}</h2><p style="margin:0 0 8px;line-height:1.5">${escapeHtml(text)}</p><p style="margin:0"><a href="${escapeHtml(link(item))}" style="color:#1a1f24;font-weight:bold">${escapeHtml(words.read)}</a></p></td></tr>`;
      })
      .join("");
    const intro = pick(input.intro, locale);
    return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(pick(input.subject, locale))}</title></head><body style="margin:0;background:#f1f3f5;font-family:Arial,Helvetica,sans-serif;color:#1a1f24"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px 8px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff"><tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">${escapeHtml(pick(input.subject, locale))}</h1>${intro ? `<p style="margin:0;line-height:1.5">${escapeHtml(intro)}</p>` : ""}</td></tr>${blocks}<tr><td style="padding:16px 24px;border-top:1px solid #d9dee4;font-size:12px;line-height:1.5;color:#4a5560">${escapeHtml(words.footer)}</td></tr></table></td></tr></table></body></html>`;
  };
  const rate = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

  return [
    // ---- Alerts ----
    authed("get", "/alerts", ({ user, locale }) => {
      if (!alertGuard(user)) return alertForbidden();
      const body: AlertRules = {
        rules: outreach.rules.map((item) => ruleOut(item, locale)),
        people: people(),
      };
      return HttpResponse.json(body);
    }),

    authed("post", "/alerts", async ({ user, request, locale }) => {
      if (!alertGuard(user)) return alertForbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<AlertRuleInput>;
      const checked = ruleErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      const next =
        Math.max(0, ...outreach.rules.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1;
      const item: StoredRule = { id: `AL-${next}`, ...checked.value, updated: now() };
      outreach.rules.push(item);
      return HttpResponse.json(ruleOut(item, locale), { status: 201 });
    }),

    // Before /alerts/:id; rule ids are AL-n, so "events" can't be one.
    authed("get", "/alerts/events", ({ user, q, locale }) => {
      if (!alertGuard(user)) return alertForbidden();
      const rule = q.get("rule");
      const rows = outreach.events
        .filter((item) => !rule || item.rule === rule)
        .sort((a, b) => b.date.localeCompare(a.date));
      const page = paged(rows, q);
      const body: Page<AlertEvent> = {
        ...page,
        items: page.items.map((item) => {
          const found = deps.indicator(item.indicator);
          return {
            ...item,
            indicatorName: indicatorName(item.indicator, locale),
            ...(item.condition === "threshold" && found
              ? { unit: localise<string>(found.unit, locale) }
              : {}),
          };
        }),
      };
      return HttpResponse.json(body);
    }),

    authed("get", "/alerts/:id", ({ user, params, locale }) => {
      if (!alertGuard(user)) return alertForbidden();
      const item = findRule(params.id!);
      return item ? HttpResponse.json(ruleOut(item, locale)) : problem(404, "Not found");
    }),

    authed("put", "/alerts/:id", async ({ user, params, request, locale }) => {
      if (!alertGuard(user)) return alertForbidden();
      const item = findRule(params.id!);
      if (!item) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Partial<AlertRuleInput>;
      const checked = ruleErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      delete item.operator;
      delete item.value;
      Object.assign(item, checked.value, { updated: now() });
      return HttpResponse.json(ruleOut(item, locale));
    }),

    // The rule's past events stay in the log under the name it had.
    authed("delete", "/alerts/:id", ({ user, params }) => {
      if (!alertGuard(user)) return alertForbidden();
      const index = outreach.rules.findIndex((item) => item.id === params.id);
      if (index < 0) return problem(404, "Not found");
      outreach.rules.splice(index, 1);
      return HttpResponse.json({ ok: true });
    }),

    // ---- Newsletter (fixed paths before /newsletter/:id; campaign ids are NL-n) ----
    authed("get", "/newsletter", ({ user, locale }) => {
      if (!letterGuard(user)) return letterForbidden();
      settle();
      return HttpResponse.json(
        [...outreach.campaigns]
          .sort((a, b) => (b.sentAt ?? b.updated).localeCompare(a.sentAt ?? a.updated))
          .map((item): CampaignSummary => {
            const recipients = reach(item);
            const sent = item.status === "sent";
            return {
              id: item.id,
              subject: pick(item.subject, locale),
              status: item.status,
              ...(item.sendAt ? { sendAt: item.sendAt } : {}),
              ...(item.sentAt ? { sentAt: item.sentAt } : {}),
              recipients,
              openRate: sent ? rate(item.opens, recipients) : null,
              clickRate: sent ? rate(item.clicks, recipients) : null,
              updated: item.updated,
            };
          }),
      );
    }),

    authed("get", "/newsletter/options", ({ user, locale }) => {
      if (!letterGuard(user)) return letterForbidden();
      const body: CampaignOptions = {
        choices: choices(locale).slice(0, 40),
        topics: deps.pillars.map((pillar) => ({
          code: pillar.code,
          name: localise<string>(pillar.name, locale),
        })),
      };
      return HttpResponse.json(body);
    }),

    authed("post", "/newsletter/preview", async ({ user, request, locale }) => {
      if (!letterGuard(user)) return letterForbidden();
      const input = (await request.json().catch(() => ({}))) as {
        campaign?: Partial<CampaignInput>;
        locale?: string;
      };
      const checked = campaignErrors(input.campaign ?? {});
      const language = locales.includes(input.locale ?? "") ? input.locale! : locale;
      const body: CampaignPreview = {
        subject: pick(checked.value.subject, language),
        html: email(checked.value, language),
        recipients: audienceSize(outreach.subscribers, checked.value.audience),
      };
      return HttpResponse.json(body);
    }),

    authed("get", "/newsletter/subscribers", ({ user, q }) => {
      if (!letterGuard(user)) return letterForbidden();
      const text = q.get("q")?.trim().toLowerCase();
      const status = q.get("status");
      const rows = outreach.subscribers
        .filter((item) => !text || item.email.toLowerCase().includes(text))
        .filter((item) => !q.get("locale") || item.locale === q.get("locale"))
        .filter((item) =>
          status === "active" || status === "unsubscribed" ? item.status === status : true,
        )
        .sort((a, b) => b.since.localeCompare(a.since) || a.email.localeCompare(b.email));
      return HttpResponse.json(paged(rows, q));
    }),

    authed("post", "/newsletter", async ({ user, request }) => {
      if (!letterGuard(user)) return letterForbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<CampaignInput>;
      const checked = campaignErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      const next =
        Math.max(0, ...outreach.campaigns.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) +
        1;
      const item: StoredCampaign = {
        id: `NL-${next}`,
        ...checked.value,
        status: "draft",
        opens: 0,
        clicks: 0,
        updated: now(),
      };
      outreach.campaigns.push(item);
      return HttpResponse.json(campaignOut(item), { status: 201 });
    }),

    authed("get", "/newsletter/:id", ({ user, params }) => {
      if (!letterGuard(user)) return letterForbidden();
      settle();
      const item = findCampaign(params.id!);
      return item ? HttpResponse.json(campaignOut(item)) : problem(404, "Not found");
    }),

    authed("put", "/newsletter/:id", async ({ user, params, request }) => {
      if (!letterGuard(user)) return letterForbidden();
      settle();
      const item = findCampaign(params.id!);
      if (!item) return problem(404, "Not found");
      if (item.status !== "draft") return typed(409, "state", "Only a draft can be edited");
      const input = (await request.json().catch(() => ({}))) as Partial<CampaignInput>;
      const checked = campaignErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      Object.assign(item, checked.value, { updated: now() });
      return HttpResponse.json(campaignOut(item));
    }),

    // `at` in the future schedules the send; otherwise it goes out now.
    authed("post", "/newsletter/:id/send", async ({ user, params, request }) => {
      if (!letterGuard(user)) return letterForbidden();
      settle();
      const item = findCampaign(params.id!);
      if (!item) return problem(404, "Not found");
      if (item.status !== "draft") return typed(409, "state", "Already sent or scheduled");
      const checked = campaignErrors(item);
      if (checked.errors.length) return invalid(checked.errors);
      if (reach(item) === 0) return typed(422, "empty", "Nobody matches this audience");
      const input = (await request.json().catch(() => ({}))) as { at?: string };
      const time = input.at ? Date.parse(input.at) : Date.now();
      if (Number.isNaN(time)) return invalid([{ path: "at", message: "format" }]);
      if (time > Date.now()) {
        item.status = "scheduled";
        item.sendAt = new Date(time).toISOString();
      } else {
        item.status = "sent";
        item.sentAt = now();
        item.recipients = audienceSize(outreach.subscribers, item.audience);
      }
      item.updated = now();
      return HttpResponse.json(campaignOut(item));
    }),

    authed("post", "/newsletter/:id/unschedule", ({ user, params }) => {
      if (!letterGuard(user)) return letterForbidden();
      settle();
      const item = findCampaign(params.id!);
      if (!item) return problem(404, "Not found");
      if (item.status !== "scheduled") return typed(409, "state", "Not scheduled");
      item.status = "draft";
      delete item.sendAt;
      item.updated = now();
      return HttpResponse.json(campaignOut(item));
    }),
  ];
}

/** Public sign-up (`POST /subscribers`): adds the address or switches it back on. */
export function subscribe(
  state: OutreachState,
  input: { email: string; locale: string; topics?: string[] },
) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) return false;
  const existing = state.subscribers.find((item) => item.email === email);
  if (existing) {
    existing.status = "active";
    existing.locale = input.locale;
    if (input.topics) existing.topics = input.topics;
  } else {
    state.subscribers.push({
      email,
      locale: input.locale,
      topics: input.topics ?? [],
      status: "active",
      since: new Date().toISOString().slice(0, 10),
    });
  }
  return true;
}
