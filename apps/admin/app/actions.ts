"use server";

import { country } from "@onn/config";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ROLE_COOKIE, ROLES, type Role } from "@/lib/session";

const YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function setRole(role: Role) {
  if (!ROLES.includes(role)) return;
  (await cookies()).set(ROLE_COOKIE, role, { path: "/admin", maxAge: YEAR_SECONDS });
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
