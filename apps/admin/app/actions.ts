"use server";

import { isMockMode } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminContext, MFA_COOKIE, ORG_COOKIE, SESSION_COOKIE } from "@/lib/session";

const YEAR_SECONDS = 60 * 60 * 24 * 365;
const CODE_LENGTH = 6;
const secure = process.env.NODE_ENV === "production";
const sessionCookie = { path: "/admin", httpOnly: true, sameSite: "lax" as const, secure };

export interface CodeState {
  error?: "invalid" | "incomplete";
}

/** MFA step: any six digits pass in the mock except 000000, which shows the error state. */
export async function verifyCode(_state: CodeState, formData: FormData): Promise<CodeState> {
  const store = await cookies();
  const pending = store.get(MFA_COOKIE)?.value;
  if (!pending) redirect("/login?error=expired");
  const code = formData.getAll("code").map(String).join("");
  if (code.length !== CODE_LENGTH || !/^\d+$/.test(code)) return { error: "incomplete" };
  if (code === "0".repeat(CODE_LENGTH)) return { error: "invalid" };
  store.delete(MFA_COOKIE);
  store.set(SESSION_COOKIE, pending, { ...sessionCookie, maxAge: 60 * 60 * 8 });
  redirect("/");
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(ORG_COOKIE);
  redirect("/login?signedOut=1");
}

/** Demo role switcher (brief §7): becomes another demo user without signing in again. */
export async function switchUser(userId: string) {
  if (!isMockMode) return;
  const users = await adminApi.demoUsers(await getLocale());
  if (!users.some((user) => user.id === userId)) return;
  const store = await cookies();
  store.set(SESSION_COOKIE, userId, { ...sessionCookie, maxAge: 60 * 60 * 8 });
  store.delete(ORG_COOKIE);
  revalidatePath("/", "layout");
}

export async function setActiveOrg(org: string) {
  const store = await cookies();
  if (org) store.set(ORG_COOKIE, org, { path: "/admin", maxAge: YEAR_SECONDS, sameSite: "lax" });
  else store.delete(ORG_COOKIE);
  revalidatePath("/", "layout");
}

export async function markNotificationsRead(ids: string[]) {
  await adminApi.markNotificationsRead(await adminContext(), ids);
  revalidatePath("/", "layout");
}

export async function setLocale(locale: string) {
  if (!country.locales.enabled.includes(locale)) return;
  (await cookies()).set("NEXT_LOCALE", locale, { path: "/", maxAge: YEAR_SECONDS });
  revalidatePath("/", "layout");
}

export async function setSidebarCollapsed(collapsed: boolean) {
  (await cookies()).set("onn-sidebar", collapsed ? "1" : "0", {
    path: "/admin",
    maxAge: YEAR_SECONDS,
  });
}
