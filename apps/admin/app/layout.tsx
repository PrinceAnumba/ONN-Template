import "@onn/ui/base.css";
import { isMockMode } from "@onn/api-client";
import { country } from "@onn/config";
import { pickMessages, type Messages } from "@onn/i18n";
import { DemoRibbon } from "@onn/ui/components/demo-ribbon";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { allowedSections } from "@/lib/sections";
import { getSession } from "@/lib/session";
import { sourceSans, sourceSansExt } from "./fonts";

export const metadata: Metadata = {
  title: `${country.observatory.shortName} — Admin`,
  robots: { index: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = (await getMessages()) as Messages;
  const t = await getTranslations("Common");
  const session = await getSession();
  const collapsed = (await cookies()).get("onn-sidebar")?.value === "1";

  return (
    <html
      lang={locale}
      dir={country.locales.rtl.includes(locale) ? "rtl" : "ltr"}
      className={`${sourceSans.variable} ${sourceSansExt.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={pickMessages(messages, ["Admin", "Common"])}>
          {isMockMode && <DemoRibbon label={t("demoData")} />}
          <AdminShell
            session={session}
            sections={allowedSections(session.roles)}
            initialCollapsed={collapsed}
            mockRoles={isMockMode}
          >
            {children}
          </AdminShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
