import type {
  AuditAction,
  AuditEntity,
  FeatureKey,
  FeedbackItem,
  Organisation,
  QuotaTier,
  RuntimeSettingKey,
  UserStatus,
} from "@onn/api-client/types";
import type { StatusTone } from "@onn/ui/components/status-pill";

/** Lists and tones for the Phase 7g screens (users, organisations, feedback, audit, settings). */

export const USER_STATUSES: UserStatus[] = ["active", "invited", "deactivated"];
export const USER_TONE: Record<UserStatus, StatusTone> = {
  active: "positive",
  invited: "info",
  deactivated: "neutral",
};

export const ORG_KINDS: Organisation["kind"][] = [
  "statistics",
  "regulator",
  "ministry",
  "international",
  "other",
];

export const FEEDBACK_STATUSES: FeedbackItem["status"][] = ["new", "planned", "done", "wont_do"];
export const FEEDBACK_TONE: Record<FeedbackItem["status"], StatusTone> = {
  new: "info",
  planned: "warning",
  done: "positive",
  wont_do: "neutral",
};

export const AUDIT_ACTIONS: AuditAction[] = [
  "create",
  "update",
  "delete",
  "publish",
  "unpublish",
  "transition",
  "invite",
  "deactivate",
  "reactivate",
  "send",
  "run",
];
export const AUDIT_ENTITIES: AuditEntity[] = [
  "submission",
  "import",
  "connector",
  "indicator",
  "dashboard",
  "publication",
  "report",
  "news",
  "page",
  "alert",
  "newsletter",
  "user",
  "organisation",
  "feedback",
  "settings",
];

export const SETTING_KEYS: RuntimeSettingKey[] = [
  "contactEmail",
  "exportMaxRows",
  "sessionMinutes",
  "cacheSeconds",
];
export const FEATURE_KEYS: FeatureKey[] = ["newsWatch", "smsSignup", "chatbot", "basemap"];
export const QUOTA_TIERS: QuotaTier[] = ["anonymous", "registered", "partner"];

export interface DiffRow {
  /** Dotted path to the value, e.g. `contacts.0.email`. */
  path: string;
  kind: "added" | "removed" | "changed";
  before?: string;
  after?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const show = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));

/**
 * The leaves that differ between two JSON values (brief §7 audit "before/after JSON diff").
 * Objects and arrays are walked; anything else is compared whole. With one side missing, every
 * leaf of the other is added or removed.
 */
export function diffJson(before: unknown, after: unknown, path = ""): DiffRow[] {
  if (isObject(before) && isObject(after) && Array.isArray(before) === Array.isArray(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    return keys.flatMap((key) => diffJson(before[key], after[key], path ? `${path}.${key}` : key));
  }
  if (before === undefined && after === undefined) return [];
  if (before === undefined || after === undefined) {
    const value = before === undefined ? after : before;
    const kind = before === undefined ? "added" : "removed";
    if (isObject(value) && Object.keys(value).length > 0) {
      return Object.entries(value).flatMap(([key, item]) =>
        before === undefined
          ? diffJson(undefined, item, path ? `${path}.${key}` : key)
          : diffJson(item, undefined, path ? `${path}.${key}` : key),
      );
    }
    return [{ path, kind, [kind === "added" ? "after" : "before"]: show(value) }];
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ path, kind: "changed", before: show(before), after: show(after) }];
}
