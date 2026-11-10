// Back-office mock for Phase 7g (brief §7): users, organisations, the feedback inbox, the audit
// log and settings. The audit chain uses a small stand-in hash; the backend chooses the real one.
import { ADMIN_ROLES, can } from "@onn/api-client/permissions";
import type {
  AdminRole,
  AdminUser,
  ApiQuota,
  AuditAction,
  AuditEntity,
  AuditEntry,
  AuditPage,
  AuditVerification,
  ChannelTest,
  FeatureKey,
  FeedbackAdminItem,
  FeedbackPage,
  OrgContact,
  Organisation,
  OrganisationAdmin,
  OrganisationAdminSummary,
  Page,
  QuotaTier,
  RuntimeSettingKey,
  SettingsAdmin,
  SettingsInput,
  UserInviteInput,
  UserPage,
  UserStatus,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type { RouteContext } from "./admin";
import type { AdminState, StoredOrg, StoredUser } from "./admin-seed";

type Method = "get" | "post" | "put" | "patch" | "delete";
type Text = Record<string, string>;
type FieldError = { path: string; message: string };

export type StoredAudit = Omit<AuditEntry, "actor"> & { actor: string };

export interface GovernanceState {
  /** Oldest first; each entry's hash covers the one before it. */
  audit: StoredAudit[];
  settings: SettingsInput & {
    smtpTest?: ChannelTest;
    smsTest?: ChannelTest;
    updated?: string;
    updatedBy?: string;
  };
}

export interface GovernanceDeps {
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
}

const PAGE_SIZES = [25, 50, 100];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = /^\+?[\d\s().-]{6,20}$/;
const KINDS: Organisation["kind"][] = [
  "statistics",
  "regulator",
  "ministry",
  "international",
  "other",
];
const FEEDBACK_STATUSES: FeedbackAdminItem["status"][] = ["new", "planned", "done", "wont_do"];
const USER_STATUSES: UserStatus[] = ["active", "invited", "deactivated"];
const TIERS: QuotaTier[] = ["anonymous", "registered", "partner"];
const FEATURES: FeatureKey[] = ["newsWatch", "smsSignup", "chatbot", "basemap"];

/** The deployment's values, which an override replaces (mock stand-ins). */
export const SETTING_DEFAULTS: Record<RuntimeSettingKey, string> = {
  contactEmail: "contact@example.org",
  exportMaxRows: "100000",
  sessionMinutes: "30",
  cacheSeconds: "300",
};
const SETTING_RANGE: Partial<Record<RuntimeSettingKey, [number, number]>> = {
  exportMaxRows: [1000, 1_000_000],
  sessionMinutes: [5, 720],
  cacheSeconds: [0, 86_400],
};
const FEATURE_DEFAULTS: Record<FeatureKey, boolean> = {
  newsWatch: true,
  smsSignup: false,
  chatbot: false,
  basemap: false,
};
const QUOTA_DEFAULTS: ApiQuota[] = [
  { tier: "anonymous", perMinute: 60, perDay: 5000 },
  { tier: "registered", perMinute: 300, perDay: 50_000 },
  { tier: "partner", perMinute: 1200, perDay: 500_000 },
];

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

/** Four rounds of FNV-1a with different seeds: 32 hex characters, the same in Node and browsers. */
function digest(text: string) {
  let out = "";
  for (const seed of [0x811c9dc5, 0x01000193, 0x9e3779b1, 0x85ebca6b]) {
    let hash = seed;
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    out += (hash >>> 0).toString(16).padStart(8, "0");
  }
  return out;
}

/** Excel reads a CSV as UTF-8 only when it starts with this. */
const BOM = String.fromCharCode(0xfeff);
const GENESIS = "0".repeat(32);
const hashOf = (entry: Omit<StoredAudit, "hash">) =>
  digest(
    JSON.stringify([
      entry.prevHash,
      entry.seq,
      entry.date,
      entry.actor,
      entry.action,
      entry.entity,
      entry.entityId,
      entry.before ?? null,
      entry.after ?? null,
    ]),
  );

/** Adds a link to the chain. Handlers that know the before and after call this themselves. */
export function recordAudit(
  state: AdminState,
  entry: {
    actor: string;
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    before?: unknown;
    after?: unknown;
    date?: string;
  },
) {
  const log = state.governance.audit;
  const clone = (value: unknown) =>
    value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as unknown);
  const link: Omit<StoredAudit, "hash"> = {
    seq: (log.at(-1)?.seq ?? 0) + 1,
    date: entry.date ?? new Date().toISOString(),
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    ...(entry.before === undefined ? {} : { before: clone(entry.before) }),
    ...(entry.after === undefined ? {} : { after: clone(entry.after) }),
    prevHash: log.at(-1)?.hash ?? GENESIS,
  };
  log.push({ ...link, hash: hashOf(link) });
}

export function verifyChain(log: StoredAudit[]): Omit<AuditVerification, "verifiedAt"> {
  let previous = GENESIS;
  for (const entry of log) {
    const { hash, ...rest } = entry;
    if (entry.prevHash !== previous || hashOf(rest) !== hash) {
      return { ok: false, checked: log.length, brokenAt: entry.seq };
    }
    previous = hash;
  }
  return { ok: true, checked: log.length };
}

const ENTITY_OF: Record<string, AuditEntity> = {
  submissions: "submission",
  imports: "import",
  connectors: "connector",
  indicators: "indicator",
  dashboards: "dashboard",
  publications: "publication",
  reports: "report",
  news: "news",
  "news-watch": "news",
  pages: "page",
  alerts: "alert",
  newsletter: "newsletter",
  users: "user",
  organisations: "organisation",
  feedback: "feedback",
  settings: "settings",
};
/** Writes that change nothing worth a line: previews, tests, autosaves and read markers. */
const QUIET =
  /\/(preview|test|dry-run|verify|media|exports|options|rows|comments)(\/|$)|^\/(notifications|entry)\//;
const LAST_ACTION: Record<string, AuditAction> = {
  publish: "publish",
  approve: "publish",
  unpublish: "unpublish",
  send: "send",
  run: "run",
  transition: "transition",
  "bulk-transition": "transition",
};

/**
 * The audit line for a successful write that didn't record its own: the entity comes from the
 * path, the action from the method or the last path segment. No before and after.
 */
export async function auditRequest(
  state: AdminState,
  user: StoredUser,
  method: Method,
  path: string,
  params: Record<string, string>,
  response: Response,
) {
  if (method === "get" || !response.ok || QUIET.test(`${path}/`)) return;
  const segments = path.split("/").filter(Boolean);
  const entity = ENTITY_OF[segments[0] ?? ""];
  if (!entity) return;
  const last = segments.at(-1) ?? "";
  const action: AuditAction =
    LAST_ACTION[last] ??
    (method === "delete"
      ? "delete"
      : method === "post" && segments.length === 1
        ? "create"
        : "update");
  let entityId = params.id ?? params.slug ?? params.code ?? "";
  if (!entityId) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null;
    entityId = String(body?.id ?? body?.slug ?? body?.code ?? segments.slice(1).join("/"));
  }
  recordAudit(state, { actor: user.id, action, entity, entityId: entityId || "-" });
}

/** Contacts, descriptions and the starting log, added to the seeded organisations and users. */
export function seedGovernance(
  state: Omit<AdminState, "governance">,
  defaultLocale: string,
  now: Date,
): GovernanceState {
  const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  const people = ["Dominique Faye", "Claude Mensah", "Andrea Diallo", "Pascal Koffi"];
  state.orgs.forEach((org, index) => {
    const slug = org.code.toLowerCase();
    org.description = {
      fr: "Fournit des données à l'observatoire selon le calendrier de collecte.",
      en: "Supplies data to the observatory on the collection calendar.",
    };
    org.website = `https://${slug}.example.org`;
    org.contacts = [
      {
        name: people[index % people.length]!,
        role: "Point focal données",
        email: `donnees@${slug}.example.org`,
        phone: `+000 555 01${String(index).padStart(2, "0")}`,
      },
    ];
    org.updated = iso(20 + index * 3);
  });

  // Two people who haven't signed in yet and one whose access was withdrawn.
  const firstOrgs = state.orgs.slice(0, 1).map((org) => org.code);
  const extra: [string, string, AdminRole, boolean, number][] = [
    ["u-7", "Charlie Sow", "contributor", true, 2],
    ["u-8", "Lou Agbeko", "editor", true, 9],
    ["u-9", "Sacha Ndiaye", "contributor", false, 200],
  ];
  for (const [id, name, role, active, days] of extra) {
    state.users.push({
      id,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.org`,
      roles: [role],
      orgs: firstOrgs,
      mfa: false,
      active,
      lastLogin: active ? "" : iso(days),
      invitedAt: iso(active ? days : days + 100),
    });
  }

  const governance: GovernanceState = {
    audit: [],
    settings: {
      overrides: {
        contactEmail: null,
        exportMaxRows: null,
        sessionMinutes: "60",
        cacheSeconds: null,
      },
      features: { ...FEATURE_DEFAULTS },
      quotas: QUOTA_DEFAULTS.map((quota) => ({ ...quota })),
      updated: iso(12),
      updatedBy: "u-super",
    },
  };
  const whole = { ...state, governance } as AdminState;

  // The starting log, in date order: what the seeded records say happened to them.
  const past: Parameters<typeof recordAudit>[1][] = [];
  for (const item of state.submissions) {
    for (const event of item.history) {
      past.push({
        actor: event.actor,
        action: "transition",
        entity: "submission",
        entityId: item.id,
        before: { status: event.from },
        after: { status: event.to, ...(event.comment ? { comment: event.comment } : {}) },
        date: event.date,
      });
    }
  }
  for (const item of state.indicators.slice(0, 12)) {
    for (const version of item.versions) {
      past.push({
        actor: state.users.find((user) => user.name === version.author)?.id ?? "u-admin",
        action: version.version === 1 ? "create" : "update",
        entity: "indicator",
        entityId: item.code,
        after: { version: version.version, note: version.note, changes: version.changes },
        date: version.date,
      });
    }
  }
  for (const user of state.users.filter((item) => item.invitedAt)) {
    past.push({
      actor: "u-admin",
      action: "invite",
      entity: "user",
      entityId: user.id,
      after: { email: user.email, roles: user.roles, orgs: user.orgs },
      date: user.invitedAt,
    });
  }
  past.push(
    {
      actor: "u-admin",
      action: "deactivate",
      entity: "user",
      entityId: "u-9",
      before: { status: "active" },
      after: { status: "deactivated" },
      date: iso(40),
    },
    {
      actor: "u-super",
      action: "update",
      entity: "settings",
      entityId: "settings",
      before: { overrides: { sessionMinutes: null } },
      after: { overrides: { sessionMinutes: "60" } },
      date: iso(12),
    },
  );
  past.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  for (const entry of past) recordAudit(whole, entry);
  return governance;
}

export function createGovernanceHandlers(deps: GovernanceDeps) {
  const { authed, localise, problem, state, locales, defaultLocale } = deps;
  const governance = state.governance;
  const now = () => new Date().toISOString();
  const forbidden = () => problem(403, "Forbidden", "Your role can't do this");
  const text = (value: unknown, max: number) =>
    String(value ?? "")
      .trim()
      .slice(0, max);
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
  const orgName = (code: string, locale: string) => {
    const org = state.orgs.find((item) => item.code === code);
    return org ? localise<string>(org.name, locale) : code;
  };
  const userName = (id: string) => state.users.find((user) => user.id === id)?.name ?? id;

  // ---- Users ----
  const statusOf = (user: StoredUser): UserStatus =>
    !user.active ? "deactivated" : user.lastLogin ? "active" : "invited";
  const userOut = (user: StoredUser, locale: string): AdminUser => ({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
    orgs: user.orgs.map((code) => ({ code, name: orgName(code, locale) })),
    mfa: user.mfa,
    status: statusOf(user),
    ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
    ...(user.invitedAt ? { invitedAt: user.invitedAt } : {}),
  });
  const userFacts = (user: StoredUser) => ({
    name: user.name,
    roles: user.roles,
    orgs: user.orgs,
    status: statusOf(user),
  });
  /** Only a super admin may give the super admin role or change someone who has it. */
  const outranked = (actor: StoredUser, roles: AdminRole[]) =>
    roles.includes("super_admin") && !actor.roles.includes("super_admin");
  const userErrors = (input: Partial<UserInviteInput>, withEmail: boolean) => {
    const errors: FieldError[] = [];
    const name = text(input.name, 80);
    if (!name) errors.push({ path: "name", message: "required" });
    const email = text(input.email, 120).toLowerCase();
    if (withEmail) {
      if (!email) errors.push({ path: "email", message: "required" });
      else if (!EMAIL.test(email)) errors.push({ path: "email", message: "email" });
      else if (state.users.some((user) => user.email.toLowerCase() === email))
        errors.push({ path: "email", message: "duplicate" });
    }
    const role = ADMIN_ROLES.find((item) => item === input.role);
    if (!role) errors.push({ path: "role", message: "unknown" });
    const orgs = [...new Set((Array.isArray(input.orgs) ? input.orgs : []).map(String))];
    if (orgs.length === 0) errors.push({ path: "orgs", message: "required" });
    else if (orgs.some((code) => !state.orgs.some((org) => org.code === code)))
      errors.push({ path: "orgs", message: "unknown" });
    return { errors, value: { name, email, role: role ?? "reader", orgs } };
  };
  const csvCell = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  // ---- Organisations ----
  const cleanText = (value: unknown, max: number): Text => {
    const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
    return Object.fromEntries(
      locales.map((locale) => [locale, text(source[locale], max)]).filter(([, item]) => item),
    ) as Text;
  };
  const orgRecord = (org: StoredOrg) => ({
    name: org.name,
    kind: org.kind,
    description: org.description ?? {},
    ...(org.website ? { website: org.website } : {}),
    contacts: org.contacts ?? [],
  });
  const orgOut = (org: StoredOrg, locale: string): OrganisationAdmin => ({
    code: org.code,
    ...orgRecord(org),
    updated: org.updated ?? "",
    indicators: state.indicators
      .filter((item) => state.indicatorOrg[item.code] === org.code)
      .map((item) => ({
        code: item.code,
        name: localise<string>(item.name, locale),
        status: item.status,
      })),
    connectors: state.connectors
      .filter((item) => item.org === org.code)
      .map(({ id, name, lastStatus, lastRun }) => ({ id, name, lastStatus, lastRun })),
    users: state.users
      .filter((user) => user.orgs.includes(org.code))
      .map((user) => ({
        id: user.id,
        name: user.name,
        roles: user.roles,
        status: statusOf(user),
      })),
  });

  // ---- Settings ----
  const settingsOut = (): SettingsAdmin => {
    const { smtpTest, smsTest, updatedBy, ...rest } = governance.settings;
    return {
      ...rest,
      defaults: SETTING_DEFAULTS,
      featureDefaults: FEATURE_DEFAULTS,
      smtp: {
        host: "smtp.example.org:587",
        from: "no-reply@example.org",
        ...(smtpTest ? { lastTest: smtpTest } : {}),
      },
      sms: { provider: "Demo SMS", sender: "ONN", ...(smsTest ? { lastTest: smsTest } : {}) },
      ...(updatedBy ? { updatedBy: userName(updatedBy) } : {}),
    };
  };
  const settingsErrors = (input: Partial<SettingsInput>) => {
    const errors: FieldError[] = [];
    const given = (input.overrides ?? {}) as Partial<Record<RuntimeSettingKey, unknown>>;
    const overrides = { ...governance.settings.overrides };
    for (const key of Object.keys(SETTING_DEFAULTS) as RuntimeSettingKey[]) {
      const value = text(given[key], 120);
      overrides[key] = value || null;
      if (!value) continue;
      const range = SETTING_RANGE[key];
      if (range) {
        const number = Number(value);
        if (!/^\d+$/.test(value) || number < range[0] || number > range[1])
          errors.push({ path: `overrides.${key}`, message: "range" });
      } else if (!EMAIL.test(value)) errors.push({ path: `overrides.${key}`, message: "email" });
    }
    const flags = (input.features ?? {}) as Partial<Record<FeatureKey, unknown>>;
    const features = Object.fromEntries(
      FEATURES.map((key) => [
        key,
        typeof flags[key] === "boolean" ? flags[key] : governance.settings.features[key],
      ]),
    ) as Record<FeatureKey, boolean>;
    const quotas = TIERS.map((tier, index): ApiQuota => {
      const found = (Array.isArray(input.quotas) ? input.quotas : []).find(
        (item) => item?.tier === tier,
      );
      const perMinute = Number(found?.perMinute);
      const perDay = Number(found?.perDay);
      if (!Number.isInteger(perMinute) || perMinute < 1 || perMinute > 100_000)
        errors.push({ path: `quotas.${index}.perMinute`, message: "range" });
      if (!Number.isInteger(perDay) || perDay < 1 || perDay > 100_000_000)
        errors.push({ path: `quotas.${index}.perDay`, message: "range" });
      else if (Number.isInteger(perMinute) && perDay < perMinute)
        errors.push({ path: `quotas.${index}.perDay`, message: "order" });
      return { tier, perMinute, perDay };
    });
    return { errors, value: { overrides, features, quotas } satisfies SettingsInput };
  };

  return [
    // ---- Users (fixed paths before /users/:id; ids are u-…) ----
    authed("get", "/users", ({ user, q, locale }) => {
      if (!can(user.roles, "user.manage")) return forbidden();
      const search = q.get("q")?.trim().toLowerCase();
      const role = q.get("role");
      const org = q.get("org");
      const matching = state.users
        .filter((item) => !role || item.roles.includes(role as AdminRole))
        .filter((item) => !org || item.orgs.includes(org))
        .filter((item) => !search || `${item.name} ${item.email}`.toLowerCase().includes(search))
        .sort((a, b) => a.name.localeCompare(b.name));
      const counts = Object.fromEntries(
        USER_STATUSES.map((status) => [
          status,
          matching.filter((item) => statusOf(item) === status).length,
        ]),
      ) as Record<UserStatus, number>;
      const status = USER_STATUSES.find((item) => item === q.get("status"));
      const page = paged(
        status ? matching.filter((item) => statusOf(item) === status) : matching,
        q,
      );
      const body: UserPage = {
        ...page,
        items: page.items.map((item) => userOut(item, locale)),
        counts,
        orgs: state.orgs.map((item) => ({ code: item.code, name: orgName(item.code, locale) })),
      };
      return HttpResponse.json(body);
    }),

    // "Access review" export (brief §7): who can do what, and when they last signed in.
    authed("get", "/users/access-review", ({ user, locale }) => {
      if (!can(user.roles, "user.manage")) return forbidden();
      const lines = [
        ["name", "email", "roles", "organisations", "status", "mfa", "last_login", "invited"],
        ...state.users.map((item) => [
          item.name,
          item.email,
          item.roles.join(" "),
          item.orgs.map((code) => orgName(code, locale)).join("; "),
          statusOf(item),
          item.mfa ? "yes" : "no",
          item.lastLogin,
          item.invitedAt ?? "",
        ]),
      ];
      return new HttpResponse(
        `${BOM}${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`,
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="access-review-${now().slice(0, 10)}.csv"`,
          },
        },
      );
    }),

    authed("post", "/users", async ({ user, request, locale }) => {
      if (!can(user.roles, "user.manage")) return forbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<UserInviteInput>;
      const checked = userErrors(input, true);
      if (checked.errors.length) return invalid(checked.errors);
      if (outranked(user, [checked.value.role]))
        return typed(403, "role", "Only a super admin can do this");
      const next =
        Math.max(0, ...state.users.map((item) => Number(item.id.replace(/\D/g, "")) || 0)) + 1;
      const created: StoredUser = {
        id: `u-${Math.max(next, 10)}`,
        name: checked.value.name,
        email: checked.value.email,
        roles: [checked.value.role],
        orgs: checked.value.orgs,
        mfa: false,
        active: true,
        lastLogin: "",
        invitedAt: now(),
      };
      state.users.push(created);
      recordAudit(state, {
        actor: user.id,
        action: "invite",
        entity: "user",
        entityId: created.id,
        after: { email: created.email, ...userFacts(created) },
      });
      return HttpResponse.json(userOut(created, locale), { status: 201 });
    }),

    authed("get", "/users/:id", ({ user, params, locale }) => {
      if (!can(user.roles, "user.manage")) return forbidden();
      const found = state.users.find((item) => item.id === params.id);
      return found ? HttpResponse.json(userOut(found, locale)) : problem(404, "Not found");
    }),

    authed("put", "/users/:id", async ({ user, params, request, locale }) => {
      if (!can(user.roles, "user.manage")) return forbidden();
      const found = state.users.find((item) => item.id === params.id);
      if (!found) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Partial<UserInviteInput>;
      const checked = userErrors(input, false);
      if (checked.errors.length) return invalid(checked.errors);
      if (outranked(user, [...found.roles, checked.value.role]))
        return typed(403, "role", "Only a super admin can do this");
      // Nobody changes their own role: an admin could otherwise lock everyone out.
      if (found.id === user.id && checked.value.role !== found.roles[0])
        return typed(409, "self", "You can't change your own role");
      const before = userFacts(found);
      found.name = checked.value.name;
      found.roles = [checked.value.role];
      found.orgs = checked.value.orgs;
      recordAudit(state, {
        actor: user.id,
        action: "update",
        entity: "user",
        entityId: found.id,
        before,
        after: userFacts(found),
      });
      return HttpResponse.json(userOut(found, locale));
    }),

    authed("post", "/users/:id/:action", ({ user, params, locale }) => {
      if (!can(user.roles, "user.manage")) return forbidden();
      const found = state.users.find((item) => item.id === params.id);
      if (!found) return problem(404, "Not found");
      if (outranked(user, found.roles)) return typed(403, "role", "Only a super admin can do this");
      const before = userFacts(found);
      if (params.action === "deactivate") {
        if (found.id === user.id) return typed(409, "self", "You can't deactivate yourself");
        if (!found.active) return typed(409, "state", "Already deactivated");
        found.active = false;
      } else if (params.action === "reactivate") {
        if (found.active) return typed(409, "state", "Already active");
        found.active = true;
      } else if (params.action === "resend") {
        if (statusOf(found) !== "invited") return typed(409, "state", "Already signed in");
        found.invitedAt = now();
      } else return problem(404, "Not found");
      recordAudit(state, {
        actor: user.id,
        action: params.action === "resend" ? "invite" : (params.action as AuditAction),
        entity: "user",
        entityId: found.id,
        before,
        after: userFacts(found),
      });
      return HttpResponse.json(userOut(found, locale));
    }),

    // ---- Organisations ----
    authed("get", "/organisations", ({ user, locale }) => {
      if (!can(user.roles, "org.manage")) return forbidden();
      return HttpResponse.json(
        state.orgs
          .map((org): OrganisationAdminSummary => ({
            code: org.code,
            name: localise<string>(org.name, locale),
            kind: org.kind,
            indicators: Object.values(state.indicatorOrg).filter((code) => code === org.code)
              .length,
            connectors: state.connectors.filter((item) => item.org === org.code).length,
            users: state.users.filter((item) => item.active && item.orgs.includes(org.code)).length,
            ...(org.contacts?.[0] ? { contact: org.contacts[0].name } : {}),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }),

    authed("get", "/organisations/:code", ({ user, params, locale }) => {
      if (!can(user.roles, "org.manage")) return forbidden();
      const org = state.orgs.find((item) => item.code === params.code);
      return org ? HttpResponse.json(orgOut(org, locale)) : problem(404, "Not found");
    }),

    authed("put", "/organisations/:code", async ({ user, params, request, locale }) => {
      if (!can(user.roles, "org.manage")) return forbidden();
      const org = state.orgs.find((item) => item.code === params.code);
      if (!org) return problem(404, "Not found");
      const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const errors: FieldError[] = [];
      const name = cleanText(input.name, 120);
      if (!name[defaultLocale]) errors.push({ path: `name.${defaultLocale}`, message: "required" });
      const kind = KINDS.find((item) => item === input.kind);
      if (!kind) errors.push({ path: "kind", message: "unknown" });
      const website = text(input.website, 200);
      if (website && !/^https:\/\/[^\s/]+\.[^\s]+$/.test(website))
        errors.push({ path: "website", message: "url" });
      const list = Array.isArray(input.contacts) ? input.contacts : [];
      if (list.length > 10) errors.push({ path: "contacts", message: "count" });
      const contacts = list.slice(0, 10).map((item, index): OrgContact => {
        const entry = (item ?? {}) as Record<string, unknown>;
        const contact = {
          name: text(entry.name, 80),
          role: text(entry.role, 80),
          email: text(entry.email, 120),
          phone: text(entry.phone, 30),
        };
        if (!contact.name) errors.push({ path: `contacts.${index}.name`, message: "required" });
        if (!contact.email) errors.push({ path: `contacts.${index}.email`, message: "required" });
        else if (!EMAIL.test(contact.email))
          errors.push({ path: `contacts.${index}.email`, message: "email" });
        if (contact.phone && !PHONE.test(contact.phone))
          errors.push({ path: `contacts.${index}.phone`, message: "phone" });
        const { phone, ...rest } = contact;
        return phone ? contact : rest;
      });
      if (errors.length) return invalid(errors);
      const before = orgRecord(org);
      org.name = name;
      org.kind = kind!;
      org.description = cleanText(input.description, 600);
      if (website) org.website = website;
      else delete org.website;
      org.contacts = contacts;
      org.updated = now();
      recordAudit(state, {
        actor: user.id,
        action: "update",
        entity: "organisation",
        entityId: org.code,
        before,
        after: orgRecord(org),
      });
      return HttpResponse.json(orgOut(org, locale));
    }),

    // ---- Feedback inbox ----
    authed("get", "/feedback", ({ user, q }) => {
      if (!can(user.roles, "feedback.view")) return forbidden();
      const search = q.get("q")?.trim().toLowerCase();
      const rating = Number(q.get("rating"));
      const matching = state.feedback
        .filter((item) => !rating || item.rating === rating)
        .filter(
          (item) =>
            !search ||
            `${item.message ?? ""} ${item.page} ${item.id}`.toLowerCase().includes(search),
        )
        .sort((a, b) => b.date.localeCompare(a.date));
      const counts = Object.fromEntries(
        FEEDBACK_STATUSES.map((status) => [
          status,
          matching.filter((item) => item.status === status).length,
        ]),
      ) as FeedbackPage["counts"];
      const status = FEEDBACK_STATUSES.find((item) => item === q.get("status"));
      const body: FeedbackPage = {
        ...paged(status ? matching.filter((item) => item.status === status) : matching, q),
        counts,
      };
      return HttpResponse.json(body);
    }),

    authed("post", "/feedback/bulk", async ({ user, request }) => {
      if (!can(user.roles, "feedback.manage")) return forbidden();
      const body = (await request.json().catch(() => null)) as {
        ids?: unknown;
        status?: string;
      } | null;
      const status = FEEDBACK_STATUSES.find((item) => item === body?.status);
      if (!status) return invalid([{ path: "status", message: "unknown" }]);
      const ids = (Array.isArray(body?.ids) ? body.ids : []).map(String).slice(0, 100);
      const done: string[] = [];
      const failed: { id: string; status: number; detail: string }[] = [];
      for (const id of ids) {
        const item = state.feedback.find((entry) => entry.id === id);
        if (!item) {
          failed.push({ id, status: 404, detail: "Not found" });
          continue;
        }
        if (item.status !== status) {
          recordAudit(state, {
            actor: user.id,
            action: "update",
            entity: "feedback",
            entityId: id,
            before: { status: item.status },
            after: { status },
          });
          item.status = status;
          item.updated = now();
        }
        done.push(id);
      }
      return HttpResponse.json({ done, failed });
    }),

    authed("patch", "/feedback/:id", async ({ user, params, request }) => {
      if (!can(user.roles, "feedback.manage")) return forbidden();
      const item = state.feedback.find((entry) => entry.id === params.id);
      if (!item) return problem(404, "Not found");
      const body = (await request.json().catch(() => ({}))) as { status?: string; note?: unknown };
      const status =
        body.status === undefined
          ? item.status
          : FEEDBACK_STATUSES.find((entry) => entry === body.status);
      if (!status) return invalid([{ path: "status", message: "unknown" }]);
      if (typeof body.note === "string" && body.note.length > 1000)
        return invalid([{ path: "note", message: "length" }]);
      const before = { status: item.status, note: item.note ?? "" };
      item.status = status;
      if (typeof body.note === "string") {
        if (body.note.trim()) item.note = body.note.trim();
        else delete item.note;
      }
      item.updated = now();
      recordAudit(state, {
        actor: user.id,
        action: "update",
        entity: "feedback",
        entityId: item.id,
        before,
        after: { status: item.status, note: item.note ?? "" },
      });
      return HttpResponse.json(item);
    }),

    // ---- Audit log ----
    authed("get", "/audit", ({ user, q }) => {
      if (!can(user.roles, "audit.view")) return forbidden();
      const actor = q.get("actor");
      const entity = q.get("entity");
      const action = q.get("action");
      const from = q.get("from");
      const to = q.get("to");
      const search = q.get("q")?.trim().toLowerCase();
      const rows = governance.audit
        .filter((item) => !actor || item.actor === actor)
        .filter((item) => !entity || item.entity === entity)
        .filter((item) => !action || item.action === action)
        .filter((item) => !from || item.date.slice(0, 10) >= from)
        .filter((item) => !to || item.date.slice(0, 10) <= to)
        .filter((item) => !search || item.entityId.toLowerCase().includes(search))
        .sort((a, b) => b.seq - a.seq);
      const page = paged(rows, q);
      const body: AuditPage = {
        ...page,
        items: page.items.map((item) => ({
          ...item,
          actor: { id: item.actor, name: userName(item.actor) },
        })),
        actors: [...new Set(governance.audit.map((item) => item.actor))]
          .map((id) => ({ id, name: userName(id) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
      return HttpResponse.json(body);
    }),

    authed("post", "/audit/verify", ({ user }) => {
      if (!can(user.roles, "audit.view")) return forbidden();
      const body: AuditVerification = { ...verifyChain(governance.audit), verifiedAt: now() };
      return HttpResponse.json(body);
    }),

    // ---- Settings ----
    authed("get", "/settings", ({ user }) =>
      can(user.roles, "settings.manage") ? HttpResponse.json(settingsOut()) : forbidden(),
    ),

    authed("put", "/settings", async ({ user, request }) => {
      if (!can(user.roles, "settings.manage")) return forbidden();
      const input = (await request.json().catch(() => ({}))) as Partial<SettingsInput>;
      const checked = settingsErrors(input);
      if (checked.errors.length) return invalid(checked.errors);
      const { overrides, features, quotas } = governance.settings;
      const before = { overrides, features, quotas };
      Object.assign(governance.settings, checked.value, { updated: now(), updatedBy: user.id });
      recordAudit(state, {
        actor: user.id,
        action: "update",
        entity: "settings",
        entityId: "settings",
        before,
        after: checked.value,
      });
      return HttpResponse.json(settingsOut());
    }),

    // Mock rule: an address at fail.example or a number ending 0000 is refused by the gateway.
    authed("post", "/settings/test/:channel", async ({ user, params, request }) => {
      if (!can(user.roles, "settings.manage")) return forbidden();
      const to = text(((await request.json().catch(() => ({}))) as { to?: unknown }).to, 120);
      if (params.channel !== "smtp" && params.channel !== "sms") return problem(404, "Not found");
      const smtp = params.channel === "smtp";
      if (!to) return invalid([{ path: "to", message: "required" }]);
      if (!(smtp ? EMAIL : PHONE).test(to))
        return invalid([{ path: "to", message: smtp ? "email" : "phone" }]);
      const failed = smtp ? to.endsWith("@fail.example") : to.replace(/\D/g, "").endsWith("0000");
      const result: ChannelTest = {
        ok: !failed,
        date: now(),
        ...(failed
          ? {
              detail: smtp
                ? "550 5.1.1 Recipient address rejected"
                : "Gateway error 21211: invalid number",
            }
          : {}),
      };
      if (smtp) governance.settings.smtpTest = result;
      else governance.settings.smsTest = result;
      return HttpResponse.json(result);
    }),
  ];
}
