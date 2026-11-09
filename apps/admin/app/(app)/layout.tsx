import { isMockMode } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { getLocale } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { allowedSections, canOpen } from "@/lib/sections";
import { requireSession } from "@/lib/session";

/** Every back-office screen except sign-in: needs a session and gets the shell (brief §4.5). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  // Hide what the role can't reach (brief §7), as a 404 sent before anything streams.
  if (!canOpen((await headers()).get("x-onn-path") ?? "/", session.roles)) notFound();
  const locale = await getLocale();
  const ctx = { locale, token: session.token };
  const [notifications, demoUsers, store] = await Promise.all([
    adminApi.notifications(ctx).catch(() => []),
    isMockMode ? adminApi.demoUsers(locale).catch(() => []) : Promise.resolve([]),
    cookies(),
  ]);

  return (
    <AdminShell
      session={{
        user: session.user,
        roles: session.roles,
        orgs: session.orgs,
        activeOrg: session.activeOrg,
      }}
      sections={allowedSections(session.roles)}
      notifications={notifications}
      demoUsers={demoUsers}
      initialCollapsed={store.get("onn-sidebar")?.value === "1"}
      mockMode={isMockMode}
    >
      {children}
    </AdminShell>
  );
}
