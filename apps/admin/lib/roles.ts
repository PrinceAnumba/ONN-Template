export const ROLES = ["super_admin", "admin", "editor", "contributor", "reader"] as const;
export type Role = (typeof ROLES)[number];
