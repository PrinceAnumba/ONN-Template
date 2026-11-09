// Back-office endpoints (brief §7). Kept out of the main entry so portal bundles never carry them.
import { apiFetch, type QueryValue } from "./client";
import type {
  AdminMe,
  AdminNotification,
  AdminOverview,
  BulkTransitionResult,
  CalendarItem,
  EntryIndicator,
  EntrySheet,
  ImportField,
  ImportFix,
  ImportJob,
  ImportSummary,
  Page,
  DemoUser,
  QualityRule,
  SubmissionAction,
  SubmissionChannel,
  SubmissionDetail,
  SubmissionPage,
  SubmissionStatus,
  TransitionInput,
} from "./types";

export interface SubmissionQuery extends Record<string, QueryValue> {
  status?: SubmissionStatus;
  q?: string;
  org?: string;
  channel?: SubmissionChannel;
  /** Last update from / to, inclusive (YYYY-MM-DD). */
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

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
  submissions: (ctx: AdminContext, query: SubmissionQuery = {}) =>
    get<SubmissionPage>("/submissions", ctx, query),
  submission: (ctx: AdminContext, id: string) =>
    get<SubmissionDetail>(`/submissions/${encodeURIComponent(id)}`, ctx),
  transition: (ctx: AdminContext, id: string, input: TransitionInput) =>
    send<SubmissionDetail>("POST", `/submissions/${encodeURIComponent(id)}/transition`, ctx, input),
  bulkTransition: (ctx: AdminContext, ids: string[], action: SubmissionAction, comment?: string) =>
    send<BulkTransitionResult>("POST", "/submissions/bulk-transition", ctx, {
      ids,
      action,
      comment,
    }),
  /** Saves the explanations for failing warnings (brief §7 *Quality* tab). */
  justify: (ctx: AdminContext, id: string, justifications: Partial<Record<QualityRule, string>>) =>
    send<SubmissionDetail>("PUT", `/submissions/${encodeURIComponent(id)}/justifications`, ctx, {
      justifications,
    }),
  /** Collection calendar for one month (`YYYY-MM`). */
  calendar: (ctx: AdminContext, month: string, org?: string) =>
    get<CalendarItem[]>("/calendar", ctx, { month, org }),
  imports: (ctx: AdminContext, query: { org?: string; page?: number; pageSize?: number } = {}) =>
    get<Page<ImportSummary>>("/imports", ctx, query),
  importJob: (ctx: AdminContext, id: string) =>
    get<ImportJob>(`/imports/${encodeURIComponent(id)}`, ctx),
  /** Confirms the column mapping (source header → field) and starts validation. */
  mapImport: (ctx: AdminContext, id: string, columns: Record<string, ImportField>) =>
    send<ImportJob>("PUT", `/imports/${encodeURIComponent(id)}/mapping`, ctx, { columns }),
  /** Fixes cells or removes rows; the job is validated again. */
  fixImport: (ctx: AdminContext, id: string, fixes: ImportFix[], remove: number[] = []) =>
    send<ImportJob>("PATCH", `/imports/${encodeURIComponent(id)}/rows`, ctx, { fixes, remove }),
  submitImport: (ctx: AdminContext, id: string, comment?: string) =>
    send<{ submission: string }>("POST", `/imports/${encodeURIComponent(id)}/submit`, ctx, {
      comment,
    }),
  entryIndicators: (ctx: AdminContext, org?: string) =>
    get<EntryIndicator[]>("/entry", ctx, { org }),
  entrySheet: (ctx: AdminContext, indicator: string, period?: string) =>
    get<EntrySheet>(`/entry/${encodeURIComponent(indicator)}`, ctx, { period }),
  /** Mock only: the users the role switcher offers. Needs no token. */
  demoUsers: (locale: string) => apiFetch<DemoUser[]>("/admin/demo-users", { locale }),
};
