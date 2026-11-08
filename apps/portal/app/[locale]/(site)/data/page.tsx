import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { IndicatorSummary } from "@onn/api-client/types";
import { country } from "@onn/config";
import { KpiCard } from "@onn/ui/components/kpi-card";
import { formatPeriod, formatValue } from "@onn/ui/format";
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createLoader, type SearchParams } from "nuqs/server";
import { PillarIcon } from "@/components/explorer/pillar-icon";
import { ProfileExport } from "@/components/explorer/profile-export";
import { Link } from "@/i18n/navigation";
import { trendOf } from "@/lib/explorer-tree";
import { tagFor } from "@/lib/format";
import { hasLatest, kindOf, kpiCardProps } from "@/lib/kpi";
import { getSelectorData } from "@/lib/selector-data";
import { urlParsers } from "@/lib/url-state";

const loadParams = createLoader({ a: urlParsers.a });
const MIN_CARDS = 4;
const MAX_CARDS = 6;
const TREND_ICON = {
  up: ArrowUpRightIcon,
  down: ArrowDownRightIcon,
  flat: ArrowRightIcon,
  none: MinusIcon,
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("data") };
}

/** With no indicator chosen, `/data` shows the focus area's digital profile (brief §5.2). */
export default async function DataPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const locale = await getLocale();
  const tag = tagFor(locale);
  const [{ a }, selector, t, home] = await Promise.all([
    loadParams(searchParams),
    getSelectorData(locale),
    getTranslations("Explorer"),
    getTranslations("Home"),
  ]);
  const area =
    selector.areas.find(
      (item) => item.code === a && item.level !== "group" && item.level !== "country",
    ) ?? selector.areas.find((item) => item.code === country.iso3);
  const areaCode = area?.code ?? country.iso3;
  const areaName = area?.name ?? country.name[locale] ?? country.iso3;
  const ctx: RequestContext = { locale, next: serverCache("profile", `area:${areaCode}`) };
  const query = areaCode === country.iso3 ? "" : `?a=${encodeURIComponent(areaCode)}`;

  let pillars: Awaited<ReturnType<typeof api.pillars>> = [];
  let indicators: IndicatorSummary[] = [];
  let failed = false;
  try {
    const [pillarList, page] = await Promise.all([
      api.pillars(ctx),
      api.indicators(ctx, { status: "published", pageSize: 200, area: areaCode }),
    ]);
    pillars = [...pillarList].sort((x, y) => x.order - y.order);
    indicators = page.items;
  } catch {
    failed = true;
  }
  const latestYear = indicators
    .flatMap((item) => (item.latest ? [item.latest.year.slice(0, 4)] : []))
    .sort()
    .at(-1);

  return (
    <main id="content" className="py-6 lg:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>{t("profileTitle", { area: areaName })}</h1>
          {latestYear && (
            <p className="rounded-pill bg-surface-2 mt-3 inline-block px-3 py-1 text-sm">
              {t("latestData", { year: latestYear })}
            </p>
          )}
        </div>
        <ProfileExport
          area={areaCode}
          labels={{
            download: t("downloadProfile"),
            preparing: t("preparing"),
            ready: t("exportReady"),
            failed: t("exportFailed"),
            timeout: t("exportTimeout"),
          }}
        />
      </header>

      {failed && (
        <p role="alert" className="bg-surface-2 mt-8 rounded-lg p-6">
          {t("sectionError")}
        </p>
      )}

      {pillars.map((pillar) => {
        const inPillar = indicators.filter((item) => item.pillar === pillar.code);
        if (!inPillar.length) return null;
        const withValue = inPillar.filter(hasLatest);
        const headline = withValue.filter((item) => item.isHeadline);
        const cards = [
          ...headline,
          ...withValue
            .filter((item) => !item.isHeadline)
            .slice(0, Math.max(0, MIN_CARDS - headline.length)),
        ].slice(0, MAX_CARDS);
        return (
          <section key={pillar.code} aria-labelledby={`pillar-${pillar.code}`} className="mt-10">
            <div className="flex items-start gap-3">
              <span className="bg-surface-2 text-primary rounded-md p-2">
                <PillarIcon name={pillar.icon} className="size-6" />
              </span>
              <div>
                <h2 id={`pillar-${pillar.code}`}>{pillar.name}</h2>
                <p className="text-muted-foreground mt-1 max-w-prose">{pillar.description}</p>
              </div>
            </div>
            {cards.length ? (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map((item) => (
                  <li key={item.code}>
                    <KpiCard
                      {...kpiCardProps(item, {
                        tag,
                        href: `/${locale}/data/${item.code}${query}`,
                        t: home,
                      })}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground mt-5">{t("noHeadline")}</p>
            )}
            <details className="group mt-4">
              <summary className="text-primary flex min-h-11 cursor-pointer items-center font-semibold underline">
                {t("seeAll", { count: inPillar.length })}
              </summary>
              <div
                role="region"
                aria-label={t("tableCaption", { pillar: pillar.name })}
                // Scrollable region must be reachable by keyboard.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
                className="mt-2 overflow-x-auto rounded-lg border"
              >
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    {t("tableCaption", { pillar: pillar.name })}
                  </caption>
                  <thead className="bg-surface-2 text-start">
                    <tr>
                      <th scope="col" className="p-3 text-start font-semibold">
                        {t("name")}
                      </th>
                      <th scope="col" className="p-3 text-end font-semibold">
                        {t("latest")}
                      </th>
                      <th scope="col" className="p-3 text-end font-semibold">
                        {t("year")}
                      </th>
                      <th scope="col" className="p-3 text-center font-semibold">
                        {t("trend")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {inPillar.map((item) => {
                      const trend = trendOf(item.latest?.changePct);
                      const Icon = TREND_ICON[trend];
                      return (
                        <tr key={item.code} className="border-t">
                          <th scope="row" className="p-3 text-start font-normal">
                            <Link href={`/data/${item.code}${query}`} className="underline">
                              {item.name}
                            </Link>
                          </th>
                          <td className="p-3 text-end tabular-nums">
                            {formatValue(item.latest?.value, kindOf(item), tag)}
                          </td>
                          <td className="p-3 text-end tabular-nums">
                            {item.latest
                              ? formatPeriod(item.latest.year, tag)
                              : formatValue(null, "count", tag)}
                          </td>
                          <td className="p-3 text-center">
                            <Icon aria-hidden className="text-muted-foreground inline size-4" />
                            <span className="sr-only">{t(`trends.${trend}`)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        );
      })}
    </main>
  );
}
