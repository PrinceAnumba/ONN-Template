import { api, serverCache } from "@onn/api-client";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { ABOUT_NAV, EXPLORE_NAV } from "@/lib/nav";
import { NewsletterForm } from "./newsletter-form";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(country.numberFormat[locale], {
    dateStyle: "long",
    timeZone: country.timezone,
  }).format(new Date(value));
}

async function SiteStatus() {
  const locale = await getLocale();
  const t = await getTranslations("Footer");
  try {
    const home = await api.home({ locale, next: serverCache("home") });
    return (
      <>
        <p className="mt-3 text-sm">{home.mission}</p>
        <p className="mt-2 text-xs opacity-80">
          {t("lastUpdated", { date: formatDate(home.lastUpdated, locale) })}
        </p>
      </>
    );
  } catch {
    return null;
  }
}

export async function SiteFooter() {
  const locale = await getLocale();
  const t = await getTranslations("Footer");
  const nav = await getTranslations("Nav");
  const owner = country.owner.ministry[locale] ?? "";

  const column = (heading: string, items: readonly { key: string; href: string }[]) => (
    <nav aria-label={heading}>
      <h2 className="text-base font-semibold">{heading}</h2>
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link href={item.href} className="flex min-h-9 items-center rounded-sm text-sm">
              {nav(item.key as Parameters<typeof nav>[0])}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <footer className="bg-foreground pt-12 pb-8 text-white">
      <div className="onn-container">
        <div className="grid gap-8 lg:grid-cols-4">
          <div>
            <Image
              src={country.brand.logo}
              alt={country.observatory.shortName}
              width={120}
              height={36}
              unoptimized
              className="brightness-0 invert"
            />

            <SiteStatus />
          </div>
          {column(t("explore"), EXPLORE_NAV)}
          {column(t("aboutHeading"), ABOUT_NAV)}
          <div>
            <h2 className="text-base font-semibold">{t("newsletter")}</h2>
            <NewsletterForm />
            {country.social.length > 0 && (
              <ul className="mt-4 flex gap-4">
                {country.social.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} rel="noreferrer" className="text-sm underline">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/20 pt-6 text-xs">
          <span>{owner}</span>
          {country.owner.funders.map((funder) => (
            <Image
              key={funder.name}
              src={funder.logo}
              alt={funder.name}
              width={96}
              height={32}
              unoptimized
              className="h-8 w-auto brightness-0 invert"
            />
          ))}
          <span className="ms-auto">{t("licence")}</span>
          <span>{t("copyright", { year: new Date().getFullYear(), owner })}</span>
        </div>
      </div>
    </footer>
  );
}
