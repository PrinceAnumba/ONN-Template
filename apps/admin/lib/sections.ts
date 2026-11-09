import { can, type AdminAction } from "@onn/api-client/permissions";
import type { Role } from "./roles";

const EVERYONE: Role[] = ["super_admin", "admin", "editor", "contributor", "reader"];
const DATA_ENTRY: Role[] = ["super_admin", "admin", "editor", "contributor"];
const EDITORS: Role[] = ["super_admin", "admin", "editor"];
const ADMINS: Role[] = ["super_admin", "admin"];
const SUPER: Role[] = ["super_admin"];

/** Sidebar order from brief §4.5. The brief leaves role access open; see CLAUDE.md. */
export const SECTIONS = [
  { key: "dashboard", href: "/", roles: EVERYONE },
  { key: "submissions", href: "/submissions", roles: DATA_ENTRY },
  { key: "entry", href: "/entry", roles: DATA_ENTRY },
  { key: "imports", href: "/imports", roles: DATA_ENTRY },
  { key: "connectors", href: "/connectors", roles: EDITORS },
  { key: "quality", href: "/quality", roles: EVERYONE },
  { key: "indicators", href: "/indicators", roles: EDITORS },
  { key: "dashboards", href: "/dashboards", roles: EDITORS },
  { key: "publications", href: "/publications", roles: EDITORS },
  { key: "reports", href: "/reports", roles: EDITORS },
  { key: "news", href: "/news", roles: EDITORS },
  { key: "pages", href: "/pages", roles: EDITORS },
  { key: "alerts", href: "/alerts", roles: EDITORS },
  { key: "newsletter", href: "/newsletter", roles: EDITORS },
  { key: "users", href: "/users", roles: ADMINS },
  { key: "organisations", href: "/organisations", roles: ADMINS },
  { key: "feedback", href: "/feedback", roles: EDITORS },
  { key: "audit", href: "/audit", roles: ADMINS },
  { key: "settings", href: "/settings", roles: SUPER },
] as const satisfies readonly { key: string; href: string; roles: Role[] }[];

export type SectionKey = (typeof SECTIONS)[number]["key"];

/** The section a path belongs to, if any. */
export function sectionFor(path: string) {
  return SECTIONS.find((section) =>
    section.href === "/"
      ? path === "/"
      : path === section.href || path.startsWith(`${section.href}/`),
  );
}

/** Screens outside the sidebar that pages already link to. */
export const PLANNED = ["/calendar", "/profile"];

/** Screens inside a section that need a right beyond the section's roles. */
const RESTRICTED: { href: string; action: AdminAction }[] = [
  { href: "/connectors/new", action: "connector.manage" },
  { href: "/indicators/new", action: "indicator.edit" },
];

/** False for paths that don't exist and sections the role can't reach (both answer 404). */
export function canOpen(path: string, roles: Role[]) {
  // A Server Action posted from sign-in renders its redirect target under the sign-in path.
  if (path === "/login" || path.startsWith("/login/")) return true;
  const restricted = RESTRICTED.find((item) => path === item.href);
  if (restricted && !can(roles, restricted.action)) return false;
  const section = sectionFor(path);
  if (section) return section.roles.some((role) => roles.includes(role));
  return PLANNED.some((href) => path === href || path.startsWith(`${href}/`));
}

export function allowedSections(roles: Role[]) {
  return SECTIONS.filter((section) => section.roles.some((role) => roles.includes(role))).map(
    ({ key, href }) => ({ key, href }),
  );
}
