// Back-office mock endpoints (brief §7) over the in-memory admin state. Every route except the
// demo user list needs `Authorization: Bearer <user id>`, and refuses what the role can't do.
import { can } from "@onn/api-client/permissions";
import type {
  AdminMe,
  AdminNotification,
  AdminOverview,
  BulkTransitionResult,
  CalendarItem,
  DemoUser,
  Organisation,
  QualityRule,
  SubmissionAction,
  SubmissionDetail,
  SubmissionPage,
  SubmissionRow,
  SubmissionStatus,
  SubmissionSummary,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type { AdminState, StoredSubmission, StoredUser } from "./admin-seed";
import { createIntakeHandlers, type IntakeDeps } from "./admin-intake";
import {
  createReferentialHandlers,
  qualityStats,
  rate,
  type ReferentialDeps,
} from "./admin-referential";
import { createContentHandlers, type ContentDeps } from "./admin-content";
import { createEditorialHandlers, type EditorialDeps } from "./admin-editorial";
import { createOutreachHandlers, type OutreachDeps } from "./admin-outreach";
import { qualityResults, rowIssues, type StoredRow } from "./admin-submissions";

type Method = "get" | "post" | "put" | "patch" | "delete";

export interface RouteContext {
  url: URL;
  q: URLSearchParams;
  locale: string;
  params: Record<string, string>;
  request: Request;
}

export interface AdminDeps {
  route: (
    method: Method,
    path: string,
    resolver: (ctx: RouteContext) => Response | Promise<Response>,
  ) => RequestHandler;
  localise: <T>(value: unknown, locale: string) => T;
  problem: (status: number, title: string, detail?: string) => Response;
  state: AdminState;
  /** Indicator and area names for submission rows (stored text, localised per request). */
  names: { indicator: (code: string) => unknown; area: (code: string) => unknown };
  /** The value before `row.period` in the published series, for the jump rule. */
  previous: (row: StoredRow) => number | null;
  /** Writes published rows into the public data and tells the apps to refresh. */
  publish: (rows: StoredRow[], indicators: string[]) => void;
  /** Catalogue lookups for imports and the entry grid. */
  intake: Pick<IntakeDeps, "iso3" | "indicators" | "areas" | "series" | "breakdowns">;
  /** Pillars, locales and the public catalogue writer for the indicator referential. */
  referential: Pick<
    ReferentialDeps,
    "pillars" | "locales" | "defaultLocale" | "geoLevels" | "syncIndicator"
  >;
  /** Public stores and lookups for dashboards, publications and reports. */
  content: Omit<ContentDeps, "authed" | "problem" | "state" | "locales" | "defaultLocale">;
  /** Public stores for news, CMS pages and the home modules. */
  editorial: Pick<EditorialDeps, "publicNews" | "publicPages" | "publicHome">;
  /** Lookups for alert rules and the newsletter. */
  outreach: Pick<OutreachDeps, "indicator" | "siteUrl">;
}

const STATUSES: SubmissionStatus[] = [
  "draft",
  "submitted",
  "verified",
  "approved",
  "published",
  "returned",
];
const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZES = [25, 50, 100];

/** Why a transition was refused. `type` lets the admin show a specific message. */
interface Refusal {
  status: 403 | 409 | 422;
  type: "role" | "state" | "own-submission" | "errors" | "unjustified" | "comment" | "scope";
  detail: string;
}

const DAY = 24 * 60 * 60 * 1000;
const DEADLINE_DAYS = 30;
const LIST_LIMIT = 5;

export function createAdminHandlers({
  route,
  localise,
  problem,
  state,
  names,
  previous,
  publish,
  intake,
  referential,
  content,
  editorial,
  outreach,
}: AdminDeps) {
  const refuse = (refusal: Refusal) =>
    HttpResponse.json(
      {
        type: refusal.type,
        title: "Transition refused",
        status: refusal.status,
        detail: refusal.detail,
      },
      { status: refusal.status, headers: { "Content-Type": "application/problem+json" } },
    );
  const orgName = (code: string, locale: string) => {
    const org = state.orgs.find((item) => item.code === code);
    return org ? localise<string>(org.name, locale) : code;
  };
  const userName = (id: string) => state.users.find((user) => user.id === id)?.name ?? id;

  const summary = (item: StoredSubmission, locale: string): SubmissionSummary => ({
    id: item.id,
    org: item.org,
    orgName: orgName(item.org, locale),
    indicators: item.indicators,
    period: item.period,
    channel: item.channel,
    status: item.status,
    submittedBy: { id: item.submittedBy, name: userName(item.submittedBy) },
    updated: item.updated,
  });

  const issuesOf = (item: StoredSubmission) => rowIssues(item.rows, previous);

  const detail = (item: StoredSubmission, locale: string): SubmissionDetail => {
    const issues = issuesOf(item);
    return {
      ...summary(item, locale),
      rows: item.rows.map((row): SubmissionRow => ({
        ...row,
        indicatorName: localise<string>(names.indicator(row.indicator), locale),
        areaName: localise<string>(names.area(row.area), locale),
        issues: issues.get(row.id) ?? [],
      })),
      quality: qualityResults(issues, item.justifications),
      history: item.history.map((event) => ({
        ...event,
        actor: { id: event.actor, name: userName(event.actor) },
      })),
      ...(item.verifiedBy
        ? { verifiedBy: { id: item.verifiedBy, name: userName(item.verifiedBy) } }
        : {}),
    };
  };

  /** Applies a workflow step, or says why the user can't take it (brief §7 workflow). */
  const transition = (
    item: StoredSubmission,
    user: StoredUser,
    action: SubmissionAction,
    comment?: string,
  ): Refusal | null => {
    if (!user.orgs.includes(item.org)) {
      return { status: 403, type: "scope", detail: "Not one of your organisations" };
    }
    const allowed: Record<SubmissionAction, SubmissionStatus[]> = {
      submit: ["draft", "returned"],
      verify: ["submitted"],
      approve: ["verified"],
      publish: ["approved"],
      return: ["submitted", "verified", "approved"],
    };
    if (!can(user.roles, `submission.${action}`)) {
      return { status: 403, type: "role", detail: `Your role can't ${action} submissions` };
    }
    if (!allowed[action].includes(item.status)) {
      return {
        status: 409,
        type: "state",
        detail: `A ${item.status} submission can't be ${action}ed`,
      };
    }
    const issues = [...issuesOf(item).values()].flat();
    if (action === "submit" && issues.some((issue) => issue.level === "error")) {
      return { status: 422, type: "errors", detail: "Fix the errors before submitting" };
    }
    if (action === "verify") {
      const unjustified = [
        ...new Set(issues.filter((issue) => issue.level === "warning").map((issue) => issue.rule)),
      ].filter((rule) => !item.justifications[rule]?.trim());
      if (unjustified.length) {
        return { status: 422, type: "unjustified", detail: `Justify: ${unjustified.join(", ")}` };
      }
    }
    if (action === "approve" && item.submittedBy === user.id) {
      return {
        status: 409,
        type: "own-submission",
        detail: "You can't approve your own submission",
      };
    }
    if (action === "return" && !comment?.trim()) {
      return { status: 422, type: "comment", detail: "Say what needs to change" };
    }

    const to: Record<SubmissionAction, SubmissionStatus> = {
      submit: "submitted",
      verify: "verified",
      approve: "approved",
      publish: "published",
      return: "returned",
    };
    const now = new Date().toISOString();
    if (action === "publish") {
      publish(item.rows, item.indicators);
      for (const row of item.rows) row.published = row.value;
    }
    if (action === "verify") item.verifiedBy = user.id;
    if (action === "submit") item.submittedBy = user.id;
    item.history.push({
      id: `${item.id}-h${item.history.length}-${Date.now()}`,
      date: now,
      from: item.status,
      to: to[action],
      actor: user.id,
      ...(comment?.trim() ? { comment: comment.trim() } : {}),
    });
    item.status = to[action];
    item.updated = now;
    return null;
  };

  /** The organisations a request covers: `?org=` if the user belongs to it, else all of theirs. */
  const scope = (user: StoredUser, q: URLSearchParams) => {
    const org = q.get("org");
    return org && user.orgs.includes(org) ? [org] : user.orgs;
  };

  /** Wraps a route with the bearer check. */
  const authed = (
    method: Method,
    path: string,
    resolver: (ctx: RouteContext & { user: StoredUser }) => Response | Promise<Response>,
  ) =>
    route(method, `/admin${path}`, (ctx) => {
      const token = ctx.request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const user = state.users.find((item) => item.id === token && item.active);
      if (!user) return problem(401, "Unauthorised", "Sign in again");
      return resolver({ ...ctx, user });
    });

  const deadlines = (orgs: string[], locale: string, now: number): CalendarItem[] =>
    state.calendar
      .filter((item) => orgs.includes(item.org) && item.status !== "received")
      .filter((item) => new Date(item.deadline).getTime() <= now + DEADLINE_DAYS * DAY)
      .sort((a, b) => a.deadline.localeCompare(b.deadline))
      .map((item) => ({
        ...item,
        orgName: orgName(item.org, locale),
        indicatorSet: localise<string>(item.indicatorSet, locale),
      }));

  const tasks = (user: StoredUser, orgs: string[]) => {
    const inScope = state.submissions
      .filter((item) => orgs.includes(item.org))
      .sort((a, b) => b.updated.localeCompare(a.updated));
    return {
      verify: can(user.roles, "submission.verify")
        ? inScope.filter((item) => item.status === "submitted")
        : [],
      approve: can(user.roles, "submission.approve")
        ? inScope.filter((item) => item.status === "verified")
        : [],
      returned: inScope.filter(
        (item) => item.status === "returned" && item.submittedBy === user.id,
      ),
    };
  };

  return [
    ...createIntakeHandlers({
      ...intake,
      authed,
      localise,
      problem,
      state,
      orgName,
      userName,
    }),
    ...createReferentialHandlers({
      ...intake,
      ...referential,
      authed,
      localise,
      problem,
      state,
      orgName,
      userName,
      names,
      previous,
    }),
    ...createContentHandlers({
      ...content,
      authed,
      problem,
      state,
      locales: referential.locales,
      defaultLocale: referential.defaultLocale,
    }),

    ...createEditorialHandlers({
      ...editorial,
      authed,
      problem,
      state,
      locales: referential.locales,
      defaultLocale: referential.defaultLocale,
      indicatorCodes: content.indicatorCodes,
      revalidate: content.revalidate,
    }),
    ...createOutreachHandlers({
      ...outreach,
      authed,
      localise,
      problem,
      state,
      locales: referential.locales,
      defaultLocale: referential.defaultLocale,
      indicatorCodes: content.indicatorCodes,
      pillars: referential.pillars,
      publicNews: editorial.publicNews,
      publicPublications: content.publicPublications,
    }),

    route("get", "/admin/demo-users", () =>
      HttpResponse.json(
        state.users
          .filter((user) => user.active)
          .map((user): DemoUser => ({ id: user.id, name: user.name, roles: user.roles })),
      ),
    ),

    authed("get", "/me", ({ user, locale }) => {
      const body: AdminMe = {
        user: { id: user.id, name: user.name, email: user.email },
        roles: user.roles,
        orgs: state.orgs
          .filter((org) => user.orgs.includes(org.code))
          .map((org): Organisation => ({ ...org, name: localise<string>(org.name, locale) })),
        mfa: user.mfa,
      };
      return HttpResponse.json(body);
    }),

    authed("get", "/overview", ({ user, q, locale }) => {
      const orgs = scope(user, q);
      const now = Date.now();
      const found = tasks(user, orgs);
      const body: AdminOverview = {
        tasks: {
          verify: found.verify.slice(0, LIST_LIMIT).map((item) => summary(item, locale)),
          approve: found.approve.slice(0, LIST_LIMIT).map((item) => summary(item, locale)),
          returned: found.returned.slice(0, LIST_LIMIT).map((item) => summary(item, locale)),
        },
        deadlines: deadlines(orgs, locale, now).slice(0, LIST_LIMIT),
        quality: (() => {
          // Same figures as the quality page (GET /admin/quality).
          const { rated, warnings } = qualityStats(
            state.submissions.filter((item) => orgs.includes(item.org)),
            previous,
          );
          const cutoff = new Date(now - DEADLINE_DAYS * DAY).toISOString();
          const all = rate(rated).passRate ?? 1;
          return {
            passRate: all,
            previous:
              rate(rated.filter((item) => item.submission.updated < cutoff)).passRate ?? all,
            openWarnings: warnings.length,
          };
        })(),
        connectorFailures: can(user.roles, "connector.view")
          ? state.connectors
              .filter((item) => orgs.includes(item.org) && item.lastStatus === "failed")
              .map(({ id, name, lastRun, error }) => ({ id, name, lastRun, error: error ?? "" }))
          : [],
        feedback: can(user.roles, "feedback.view")
          ? [...state.feedback].sort((a, b) => b.date.localeCompare(a.date)).slice(0, LIST_LIMIT)
          : [],
        usage: can(user.roles, "usage.view") ? state.usage : [],
      };
      return HttpResponse.json(body);
    }),

    authed("get", "/submissions", ({ user, q, locale }) => {
      const orgs = scope(user, q);
      const text = q.get("q")?.trim().toLowerCase();
      const channel = q.get("channel");
      const inScope = state.submissions
        .filter((item) => orgs.includes(item.org))
        .filter((item) => !channel || item.channel === channel)
        // Date range on the last update, inclusive (YYYY-MM-DD).
        .filter((item) => !q.get("from") || item.updated.slice(0, 10) >= q.get("from")!)
        .filter((item) => !q.get("to") || item.updated.slice(0, 10) <= q.get("to")!)
        .filter(
          (item) =>
            !text ||
            [item.id, orgName(item.org, locale), userName(item.submittedBy), ...item.indicators]
              .join(" ")
              .toLowerCase()
              .includes(text),
        )
        .sort((a, b) => b.updated.localeCompare(a.updated));
      const counts = Object.fromEntries(
        STATUSES.map((status) => [status, inScope.filter((item) => item.status === status).length]),
      ) as Record<SubmissionStatus, number>;
      const status = STATUSES.find((item) => item === q.get("status"));
      const rows = status ? inScope.filter((item) => item.status === status) : inScope;
      const requested = Number(q.get("pageSize"));
      const pageSize = PAGE_SIZES.includes(requested) ? requested : DEFAULT_PAGE_SIZE;
      const pages = Math.max(1, Math.ceil(rows.length / pageSize));
      const page = Math.min(Math.max(1, Number(q.get("page")) || 1), pages);
      const body: SubmissionPage = {
        items: rows
          .slice((page - 1) * pageSize, page * pageSize)
          .map((item) => summary(item, locale)),
        meta: { total: rows.length, page, pageSize },
        counts,
      };
      return HttpResponse.json(body);
    }),

    authed("post", "/submissions/bulk-transition", async ({ user, request }) => {
      const body = (await request.json().catch(() => null)) as {
        ids?: unknown;
        action?: SubmissionAction;
        comment?: string;
      } | null;
      const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string") : [];
      const result: BulkTransitionResult = { done: [], failed: [] };
      for (const id of ids) {
        const item = state.submissions.find((entry) => entry.id === id);
        if (!item) {
          result.failed.push({ id, status: 404, detail: "Not found" });
          continue;
        }
        const refused = transition(item, user, body?.action ?? "submit", body?.comment);
        if (refused) result.failed.push({ id, status: refused.status, detail: refused.type });
        else result.done.push(id);
      }
      return HttpResponse.json(result);
    }),

    authed("get", "/submissions/:id", ({ user, params, locale }) => {
      const item = state.submissions.find((entry) => entry.id === params.id);
      if (!item || !user.orgs.includes(item.org))
        return problem(404, "Not found", `${params.id} does not exist`);
      return HttpResponse.json(detail(item, locale));
    }),

    authed("post", "/submissions/:id/transition", async ({ user, params, request, locale }) => {
      const item = state.submissions.find((entry) => entry.id === params.id);
      if (!item || !user.orgs.includes(item.org))
        return problem(404, "Not found", `${params.id} does not exist`);
      const body = (await request.json().catch(() => null)) as {
        action?: SubmissionAction;
        comment?: string;
      } | null;
      const refused = transition(item, user, body?.action ?? "submit", body?.comment);
      return refused ? refuse(refused) : HttpResponse.json(detail(item, locale));
    }),

    authed("put", "/submissions/:id/justifications", async ({ user, params, request, locale }) => {
      const item = state.submissions.find((entry) => entry.id === params.id);
      if (!item || !user.orgs.includes(item.org))
        return problem(404, "Not found", `${params.id} does not exist`);
      if (!can(user.roles, "submission.verify") && !can(user.roles, "submission.submit")) {
        return refuse({ status: 403, type: "role", detail: "Your role can't justify warnings" });
      }
      const body = (await request.json().catch(() => null)) as {
        justifications?: Partial<Record<QualityRule, unknown>>;
      } | null;
      for (const [rule, text] of Object.entries(body?.justifications ?? {})) {
        if (typeof text !== "string") continue;
        if (text.trim()) item.justifications[rule as QualityRule] = text.trim().slice(0, 1000);
        else delete item.justifications[rule as QualityRule];
      }
      return HttpResponse.json(detail(item, locale));
    }),

    authed("get", "/calendar", ({ user, q, locale }) => {
      const orgs = scope(user, q);
      const month = /^\d{4}-\d{2}$/.test(q.get("month") ?? "") ? q.get("month")! : "";
      return HttpResponse.json(
        state.calendar
          .filter((item) => orgs.includes(item.org) && (!month || item.deadline.startsWith(month)))
          .sort((a, b) => a.deadline.localeCompare(b.deadline))
          .map((item): CalendarItem => ({
            ...item,
            orgName: orgName(item.org, locale),
            indicatorSet: localise<string>(item.indicatorSet, locale),
          })),
      );
    }),

    authed("get", "/notifications", ({ user, locale }) => {
      const read = state.read.get(user.id) ?? new Set<string>();
      const found = tasks(user, user.orgs);
      const items: Omit<AdminNotification, "read">[] = [
        ...found.verify.map((item) => ({
          id: `verify-${item.id}`,
          kind: "verify" as const,
          subject: item.id,
          href: `/submissions/${item.id}`,
          date: item.updated,
        })),
        ...found.approve.map((item) => ({
          id: `approve-${item.id}`,
          kind: "approve" as const,
          subject: item.id,
          href: `/submissions/${item.id}`,
          date: item.updated,
        })),
        ...found.returned.map((item) => ({
          id: `returned-${item.id}`,
          kind: "returned" as const,
          subject: item.id,
          href: `/submissions/${item.id}`,
          date: item.updated,
        })),
        ...deadlines(user.orgs, locale, Date.now())
          .filter((item) => item.status === "overdue")
          .map((item) => ({
            id: `deadline-${item.id}`,
            kind: "deadline" as const,
            subject: item.orgName,
            href: "/calendar",
            date: item.deadline,
          })),
        ...(can(user.roles, "connector.view") ? state.connectors : [])
          .filter((item) => user.orgs.includes(item.org) && item.lastStatus === "failed")
          .map((item) => ({
            id: `connector-${item.id}-${item.lastRun}`,
            kind: "connector" as const,
            subject: item.name,
            href: `/connectors/${item.id}`,
            date: item.lastRun,
          })),
        ...(can(user.roles, "feedback.view") ? state.feedback : [])
          .filter((item) => item.status === "new")
          .map((item) => ({
            id: `feedback-${item.id}`,
            kind: "feedback" as const,
            subject: item.page,
            href: "/feedback",
            date: item.date,
          })),
      ];
      return HttpResponse.json(
        items
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 20)
          .map((item) => ({ ...item, read: read.has(item.id) })),
      );
    }),

    authed("post", "/notifications/read", async ({ user, request }) => {
      const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
      const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string") : [];
      const read = state.read.get(user.id) ?? new Set<string>();
      for (const id of ids) read.add(id);
      state.read.set(user.id, read);
      return HttpResponse.json({ ok: true });
    }),
  ];
}
