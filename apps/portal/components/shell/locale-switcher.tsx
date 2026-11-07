"use client";

import { country } from "@onn/config";
import { cn } from "@onn/ui/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Fragment } from "react";
import { Link, usePathname } from "@/i18n/navigation";

const SEPARATOR = "·";

/** Changes language and keeps the current path and query (brief §4.1). */
export function LocaleSwitcher() {
  const t = useTranslations("Header");
  const current = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <nav aria-label={t("language")} className="flex items-center gap-1 text-[15px]">
      {country.locales.enabled.map((locale, index) => (
        <Fragment key={locale}>
          {index > 0 && <span aria-hidden>{SEPARATOR}</span>}
          <Link
            href={href}
            locale={locale}
            lang={locale}
            aria-current={locale === current ? "true" : undefined}
            className={cn(
              "flex min-h-11 min-w-8 items-center justify-center rounded-sm",
              locale === current && "font-bold",
            )}
          >
            {locale.toUpperCase()}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
