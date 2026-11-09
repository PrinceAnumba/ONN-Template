import "server-only";
import { ApiError } from "@onn/api-client";
import { adminApi, type AdminContext } from "@onn/api-client/admin";
import type { AdminRole, Organisation } from "@onn/api-client/types";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

/** The session token: a demo user id against the mock, the IdP's access token later (Auth.js). */
export const SESSION_COOKIE = "onn-session";
/** Set between the SSO step and the MFA code (brief §7 sign-in). */
export const MFA_COOKIE = "onn-mfa-pending";
export const ORG_COOKIE = "onn-org";

export interface Session {
  token: string;
  user: { id: string; name: string; email: string };
  roles: AdminRole[];
  orgs: Organisation[];
  /** Organisation the user is working for; undefined means all of theirs. */
  activeOrg?: string;
  mfa: boolean;
}

/** The signed-in user, or null. One `/admin/me` call per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const me = await adminApi.me({ locale: await getLocale(), token });
    const stored = store.get(ORG_COOKIE)?.value;
    const activeOrg = me.orgs.some((org) => org.code === stored) ? stored : undefined;
    return { token, ...me, activeOrg };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Locale and token for an admin API call. */
export async function adminContext(): Promise<AdminContext> {
  const session = await requireSession();
  return { locale: await getLocale(), token: session.token };
}
