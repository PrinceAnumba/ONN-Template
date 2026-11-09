// What each back-office role may do (brief §7). Shared by the admin UI, which hides what a role
// can't do, and the mock server, which refuses it. The brief names the roles but not their
// rights; this mapping is an assumption to confirm (see CLAUDE.md "Admin role access").
import type { AdminRole } from "./types";

export const ADMIN_ROLES: readonly AdminRole[] = [
  "super_admin",
  "admin",
  "editor",
  "contributor",
  "reader",
];

const RIGHTS = {
  "submission.submit": ["super_admin", "admin", "contributor"],
  "submission.verify": ["super_admin", "admin", "editor"],
  "submission.approve": ["super_admin", "admin"],
  "submission.publish": ["super_admin", "admin"],
  "submission.return": ["super_admin", "admin", "editor"],
  "connector.view": ["super_admin", "admin", "editor"],
  "connector.manage": ["super_admin", "admin"],
  "indicator.view": ["super_admin", "admin", "editor"],
  "indicator.edit": ["super_admin", "admin"],
  "content.edit": ["super_admin", "admin", "editor"],
  "feedback.view": ["super_admin", "admin", "editor"],
  "usage.view": ["super_admin", "admin", "editor", "reader"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminAction = keyof typeof RIGHTS;

export function can(roles: readonly AdminRole[], action: AdminAction) {
  return roles.some((role) => (RIGHTS[action] as readonly AdminRole[]).includes(role));
}
