import "@onn/ui/base.css";
import { isMockMode } from "@onn/api-client";
import { country } from "@onn/config";
import { pickMessages, type Messages } from "@onn/i18n";
import { DemoRibbon } from "@onn/ui/components/demo-ribbon";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { sourceSans, sourceSansExt } from "./fonts";

export const metadata: Metadata = {
  title: `${country.observatory.shortName} — Admin`,
  robots: { index: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = (await getMessages()) as Messages;
  const t = await getTranslations("Common");

  return (
    <html
      lang={locale}
      dir={country.locales.rtl.includes(locale) ? "rtl" : "ltr"}
      className={`${sourceSans.variable} ${sourceSansExt.variable}`}
    >
      <body>
        <a
          href="#content"
          className="bg-background sr-only rounded-md p-3 focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider messages={pickMessages(messages, ["Admin", "Common"])}>
          {isMockMode && <DemoRibbon label={t("demoData")} />}
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
