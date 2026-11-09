// Back-office endpoints (brief §7). Kept out of the main entry so portal bundles never carry them.
import { apiFetch, type QueryValue } from "./client";
import type { AdminMe, AdminNotification, AdminOverview, DemoUser } from "./types";

/** Every admin call needs the locale and the session's bearer token. */
export interface AdminContext {
  locale: string;
  token: string;
  signal?: AbortSignal;
}

const get = <T>(path: string, ctx: AdminContext, query?: Record<string, QueryValue>) =>
  apiFetch<T>(`/admin${path}`, { ...ctx, query });
const send = <T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  ctx: AdminContext,
  body?: unknown,
) => apiFetch<T>(`/admin${path}`, { ...ctx, method, body: body ?? {} });

export const adminApi = {
  me: (ctx: AdminContext) => get<AdminMe>("/me", ctx),
  overview: (ctx: AdminContext, org?: string) => get<AdminOverview>("/overview", ctx, { org }),
  notifications: (ctx: AdminContext) => get<AdminNotification[]>("/notifications", ctx),
  markNotificationsRead: (ctx: AdminContext, ids: string[]) =>
    send<{ ok: true }>("POST", "/notifications/read", ctx, { ids }),
  /** Mock only: the users the role switcher offers. Needs no token. */
  demoUsers: (locale: string) => apiFetch<DemoUser[]>("/admin/demo-users", { locale }),
};
