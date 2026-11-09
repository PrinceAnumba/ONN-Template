import "@onn/ui/base.css";
import { country } from "@onn/config";
import { CLIENT_NAMESPACES, pickMessages, type Messages } from "@onn/i18n";
import { Toaster } from "@onn/ui/components/toast";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";
import { isLite } from "@/lib/lite";
import { sourceSans, sourceSansExt } from "../fonts";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const suffix = `${country.observatory.shortName} ${country.name[locale] ?? ""}`;
  return {
    title: { template: `%s — ${suffix}`, default: suffix },
    icons: { icon: country.brand.favicon },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = (await getMessages()) as Messages;
  const t = await getTranslations("Common");
  const lite = await isLite();

  return (
    <html
      lang={locale}
      dir={country.locales.rtl.includes(locale) ? "rtl" : "ltr"}
      className={`${sourceSans.variable} ${sourceSansExt.variable}`}
      data-lite={lite ? "" : undefined}
    >
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider messages={pickMessages(messages, [...CLIENT_NAMESPACES])}>
          {children}
          <Toaster closeLabel={t("close")} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
