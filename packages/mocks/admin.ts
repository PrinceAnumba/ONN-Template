// Back-office mock endpoints (brief §7) over the in-memory admin state. Every route except the
// demo user list needs `Authorization: Bearer <user id>`, and refuses what the role can't do.
import { can } from "@onn/api-client/permissions";
import type {
  AdminMe,
  AdminNotification,
  AdminOverview,
  CalendarItem,
  DemoUser,
  Organisation,
  SubmissionSummary,
} from "@onn/api-client/types";
import { HttpResponse, type RequestHandler } from "msw";
import type { AdminState, StoredSubmission, StoredUser } from "./admin-seed";

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
}

const DAY = 24 * 60 * 60 * 1000;
const DEADLINE_DAYS = 30;
const LIST_LIMIT = 5;

export function createAdminHandlers({ route, localise, problem, state }: AdminDeps) {
  const orgName = (code: string, locale: string) => {
    const org = state.orgs.find((item) => item.code === code);
    return org ? localise<string>(org.name, locale) : code;
  };
  const userName = (id: string) => state.users.find((user) => user.id === id)?.name ?? id;

  const summary = (item: StoredSubmission, locale: string): SubmissionSummary => ({
    ...item,
    orgName: orgName(item.org, locale),
    submittedBy: { id: item.submittedBy, name: userName(item.submittedBy) },
  });

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
        quality: {
          ...state.quality,
          openWarnings: state.submissions.filter(
            (item) => orgs.includes(item.org) && ["submitted", "verified"].includes(item.status),
          ).length,
        },
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
