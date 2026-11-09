import { api, serverCache } from "@onn/api-client";
import type { IndicatorSummary } from "@onn/api-client/types";
import { country } from "@onn/config";
import { MailIcon, MessageSquareIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CmsPageView, cmsMetadata } from "@/components/cms/cms-page";
import { tagFor } from "@/lib/format";
import { pick } from "@/lib/localised";

export const generateMetadata = () => cmsMetadata("about");

const ALL = 500;
const CALENDAR_MONTHS = 12;
const SEPARATOR = " · ";

/** "2027-03" → "March 2027" in the page language. */
function monthLabel(month: string, locale: string) {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(tagFor(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 2000, (m ?? 1) - 1, 1)));
}

/** About (brief §5.9): CMS blocks, the release calendar and a contact card. */
export default async function AboutPage() {
  const locale = await getLocale();
  const [t, nav] = await Promise.all([getTranslations("About"), getTranslations("Nav")]);
  let upcoming: IndicatorSummary[] = [];
  try {
    const page = await api.indicators(
      { locale, next: serverCache("catalogue") },
      { status: "published", pageSize: ALL },
    );
    const now = new Date().toISOString().slice(0, 7);
    const last = new Date();
    last.setUTCMonth(last.getUTCMonth() + CALENDAR_MONTHS);
    const until = last.toISOString().slice(0, 7);
    upcoming = page.items
      .filter((item) => item.nextRelease && item.nextRelease >= now && item.nextRelease <= until)
      .sort(
        (a, b) =>
          (a.nextRelease ?? "").localeCompare(b.nextRelease ?? "") ||
          a.name.localeCompare(b.name, locale),
      );
  } catch {
    // The calendar says it couldn't load.
  }

  return (
    <CmsPageView slug="about" section="about">
      <section aria-labelledby="calendar">
        <h2 id="calendar">{t("calendar")}</h2>
        <p className="text-muted-foreground mt-1 max-w-prose">{t("calendarIntro")}</p>
        {upcoming.length ? (
          <div
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            role="region"
            aria-labelledby="calendar"
            className="relative mt-4 max-h-[480px] max-w-3xl overflow-auto rounded-lg border"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">{t("calendar")}</caption>
              <thead className="bg-surface-2 sticky top-0">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">
                    {t("calendarIndicator")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-semibold">
                    {t("calendarMonth")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((item) => (
                  <tr key={item.code} className="border-t">
                    <th scope="row" className="px-3 py-2 text-start font-normal">
                      <Link href={`/data/${item.code}`} className="text-primary underline">
                        {item.name}
                      </Link>
                    </th>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {monthLabel(item.nextRelease ?? "", locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="bg-surface-2 mt-4 max-w-prose rounded-lg p-4">{t("calendarEmpty")}</p>
        )}
      </section>

      <section aria-labelledby="contact" className="bg-surface-2 max-w-prose rounded-lg p-6">
        <h2 id="contact">{t("contact")}</h2>
        <p className="mt-2 font-semibold">{pick(country.observatory.longName, locale)}</p>
        <p className="text-muted-foreground">
          {pick(country.owner.unit, locale)}
          {SEPARATOR}
          {pick(country.owner.ministry, locale)}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          <li>
            <a
              href={`mailto:${country.observatory.supportEmail}`}
              className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
            >
              <MailIcon aria-hidden className="size-5" />
              {country.observatory.supportEmail}
            </a>
          </li>
          <li>
            <Link
              href="/feedback?page=/about"
              className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
            >
              <MessageSquareIcon aria-hidden className="size-5" />
              {nav("feedback")}
            </Link>
          </li>
          {country.social.map((link) => (
            <li key={link.url}>
              <a href={link.url} rel="noopener" className="text-primary underline">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </CmsPageView>
  );
}
