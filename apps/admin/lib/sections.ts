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

export function allowedSections(roles: Role[]) {
  return SECTIONS.filter((section) => section.roles.some((role) => roles.includes(role))).map(
    ({ key, href }) => ({ key, href }),
  );
}
