import { cookies } from "next/headers";
import { ROLES, type Role } from "./roles";

export { ROLES, type Role };

export const ROLE_COOKIE = "onn-mock-role";

export interface Session {
  user: { name: string; email: string };
  roles: Role[];
  orgs: { code: string; name: string }[];
  activeOrg: string;
  mfa: boolean;
  unreadNotifications: number;
}

/** Mock session until Auth.js is wired in (brief §7). The role comes from the profile menu. */
export async function getSession(): Promise<Session> {
  const stored = (await cookies()).get(ROLE_COOKIE)?.value;
  const role = ROLES.find((item) => item === stored) ?? "admin";
  return {
    user: { name: "Demo User", email: "demo@example.org" },
    roles: [role],
    orgs: [
      { code: "OBS", name: "Observatoire" },
      { code: "REG", name: "Autorité de régulation" },
    ],
    activeOrg: "OBS",
    mfa: true,
    unreadNotifications: 3,
  };
}
