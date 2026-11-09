// Home page sections (brief §5.1). Each is an async Server Component that fetches in parallel
// with the others and catches its own failure, so one broken call never blanks the page. They
// aren't streamed: a Suspense fallback would stay on screen without JavaScript (§9).
import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { IndicatorSummary } from "@onn/api-client/types";
import { choropleth } from "@onn/charts/classify";
import { ChoroplethSvg } from "@onn/charts/choropleth-svg";
import { chartTokens } from "@onn/config/tokens";
import { country } from "@onn/config";
import { KpiCard } from "@onn/ui/components/kpi-card";
import { TargetProgress } from "@onn/ui/components/target-progress";
import { formatPeriod, formatValue } from "@onn/ui/format";
import { cn } from "@onn/ui/lib/utils";
import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { isLite } from "@/lib/lite";
import { boundaryCredit } from "@/lib/boundaries";
import { formatBytes, formatDate, tagFor } from "@/lib/format";
import { extremes, targetProgress } from "@/lib/home";
import { hasLatest, kindOf, kpiCardProps } from "@/lib/kpi";
import { DashboardCard, dashboardThumbnail } from "@/components/dashboard/dashboard-card";
import { ScrollDots } from "./scroll-dots";

const SEPARATOR = " · ";

async function context(): Promise<RequestContext & { locale: string }> {
  const locale = await getLocale();
  return { locale, next: serverCache("home") };
}

function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("onn-container py-12", className)}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export async function KeyFigures() {
  const ctx = await context();
  const t = await getTranslations("Home");
  const tag = tagFor(ctx.locale);
  try {
    const [home, page] = await Promise.all([
      api.home(ctx),
      api.indicators(ctx, { headline: true, pageSize: 50 }),
    ]);
    const byCode = new Map(page.items.map((item) => [item.code, item]));
    const cards = home.featuredIndicators
      .map((code) => byCode.get(code))
      .filter((item): item is IndicatorSummary => Boolean(item))
      .filter(hasLatest)
      .slice(0, 8);
    const latestYear = cards
      .map((card) => card.latest.year.slice(0, 4))
      .sort()
      .at(-1);

    return (
      <Section
        title={t("keyFigures")}
        aside={
          latestYear && <p className="text-muted-foreground">{t("asOf", { year: latestYear })}</p>
        }
      >
        <ul
          id="key-figures"
          className="relative grid gap-3 max-sm:-mx-4 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6"
        >
          {cards.map((card) => (
            <li key={card.code} className="shrink-0 snap-start max-sm:w-[82%]">
              <KpiCard
                {...kpiCardProps(card, { tag, href: `/${ctx.locale}/data/${card.code}`, t })}
              />
            </li>
          ))}
        </ul>
        <ScrollDots target="key-figures" count={cards.length} />
      </Section>
    );
  } catch {
    return null;
  }
}

export async function StrategyTracker() {
  const ctx = await context();
  const t = await getTranslations("Home");
  const tag = tagFor(ctx.locale);
  try {
    const strategy = await api.targets(ctx);
    const rows = await Promise.all(
      strategy.targets.map(async (target) => {
        const [indicator, series] = await Promise.all([
          api.indicator(ctx, target.indicator),
          api.series(ctx, { indicator: target.indicator, area: country.iso3 }),
        ]);
        const kind = kindOf(indicator);
        const progress = targetProgress(
          series[0],
          target.target,
          target.targetYear,
          indicator.higherIsBetter,
        );
        return { target, indicator, kind, progress };
      }),
    );
    return (
      <Section title={strategy.name} className="border-t">
        <ul className="flex flex-col gap-6">
          {rows.map(({ target, indicator, kind, progress }) => (
            <li key={target.indicator}>
              <TargetProgress
                name={target.name}
                valueShare={progress.valueShare}
                targetShare={progress.targetShare}
                caption={t("targetCaption", {
                  current: formatValue(progress.current, kind, tag),
                  target: formatValue(target.target, kind, tag),
                  year: target.targetYear,
                })}
                status={progress.status}
                statusLabel={progress.status && t(`status.${progress.status}`)}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                {t("sourceYear", {
                  source: indicator.source.org,
                  year: progress.currentPeriod ? formatPeriod(progress.currentPeriod, tag) : "—",
                })}{" "}
                <Link href={`/data/${indicator.code}`} className="underline">
                  {t("metadata")}
                </Link>
              </p>
            </li>
          ))}
        </ul>
      </Section>
    );
  } catch {
    return null;
  }
}

export async function MapTeaser() {
  const ctx = await context();
  const t = await getTranslations("Home");
  const tag = tagFor(ctx.locale);
  try {
    const home = await api.home(ctx);
    const code = home.mapTeaserIndicator;
    const [indicator, rows, topology, regions, credit] = await Promise.all([
      api.indicator(ctx, code),
      api.latest(ctx, { indicator: code, level: "adm1" }),
      api.geometry(ctx, country.iso3, "adm1"),
      api.areas(ctx, { level: "adm1" }),
      boundaryCredit(),
    ]);
    const kind = kindOf(indicator);
    const values = Object.fromEntries(regions.map((area) => [area.code, null as number | null]));
    rows.forEach((row) => (values[row.area] = row.value));
    const { fills } = choropleth(values, "quantile", chartTokens.sequential);
    const nameOf = (area: string) => regions.find((region) => region.code === area)?.name ?? area;
    const range = extremes(rows);
    const year = rows[0] ? formatPeriod(rows[0].period, tag) : "";

    return (
      <section className="onn-container py-12">
        <Link
          href={`/map?i=${code}`}
          className="bg-surface-2 grid items-center gap-6 rounded-lg p-6 transition-shadow duration-(--onn-dur-2) hover:shadow-sm md:grid-cols-2 md:p-8"
        >
          <div>
            <h2>{t("mapTitle")}</h2>
            <p className="mt-3 text-lg">{t("mapIndicator", { indicator: indicator.name, year })}</p>
            {range && (
              <dl className="mt-4 grid gap-1">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{t("highest")}</dt>
                  <dd className="font-semibold">
                    {nameOf(range.highest.area)}
                    {SEPARATOR}
                    {formatValue(range.highest.value, kind, tag)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{t("lowest")}</dt>
                  <dd className="font-semibold">
                    {nameOf(range.lowest.area)}
                    {SEPARATOR}
                    {formatValue(range.lowest.value, kind, tag)}
                  </dd>
                </div>
              </dl>
            )}
            <p className="text-muted-foreground mt-4 text-xs">
              {t("sourceYear", { source: indicator.source.org, year })}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{credit}</p>
            <span className="text-primary mt-4 inline-block font-semibold underline">
              {t("openMap")}
            </span>
          </div>
          <ChoroplethSvg
            id="home-map"
            topology={topology}
            codeProperty={country.geography.codeProperty}
            fills={fills}
            title={t("mapIndicator", { indicator: indicator.name, year })}
            labels={Object.fromEntries(
              rows.map((row) => [
                row.area,
                `${nameOf(row.area)}: ${formatValue(row.value, kind, tag)}`,
              ]),
            )}
            width={560}
            height={360}
          />
        </Link>
      </section>
    );
  } catch {
    return null;
  }
}

export async function BenchmarkStrip() {
  const ctx = await context();
  const t = await getTranslations("Home");
  const tag = tagFor(ctx.locale);
  try {
    const home = await api.home(ctx);
    const group = country.peers.default;
    const [indicator, benchmark] = await Promise.all([
      api.indicator(ctx, home.benchmarkIndicator),
      api.benchmark(ctx, { indicator: home.benchmarkIndicator, group }),
    ]);
    const kind = kindOf(indicator);
    const max = Math.max(...benchmark.rows.map((row) => row.value ?? 0)) || 1;
    const year = benchmark.rows[0]?.year ?? "";
    const groupName = country.peers.groups[group]?.name[ctx.locale] ?? group;

    return (
      <Section
        title={t("benchmarkTitle", { indicator: indicator.name, group: groupName, year })}
        className="border-t"
        aside={
          <Link
            href={`/benchmark?i=${indicator.code}`}
            className="text-primary font-semibold underline"
          >
            {t("compareMore")}
          </Link>
        }
      >
        <ol className="flex flex-col gap-1.5">
          {benchmark.rows.map((row) => {
            const focus = row.area === country.iso3;
            return (
              <li
                key={row.area}
                className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr]"
              >
                <span className={cn("truncate", focus && "font-semibold")}>{row.name}</span>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("h-5 rounded-e-sm", focus ? "bg-brand" : "bg-compare")}
                    style={{ width: `${((row.value ?? 0) / max) * 85}%` }}
                  />
                  <span className={cn("tabular-nums", focus && "font-semibold")}>
                    {formatValue(row.value, kind, tag)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-muted-foreground mt-4 text-xs">
          {t("peerNote", { date: formatDate(benchmark.retrievedAt, ctx.locale) })}
        </p>
      </Section>
    );
  } catch {
    return null;
  }
}

export async function DashboardCards() {
  const ctx = await context();
  const t = await getTranslations("Home");
  try {
    const dashboards = await api.dashboards(ctx);
    const cards = await Promise.all(
      dashboards.slice(0, 3).map(async (dashboard) => ({
        dashboard,
        thumbnail: await dashboardThumbnail(dashboard, ctx),
      })),
    );
    return (
      <Section
        title={t("dashboards")}
        className="border-t"
        aside={
          <Link href="/dashboards" className="text-primary font-semibold underline">
            {t("seeAll")}
          </Link>
        }
      >
        <ul className="grid gap-6 md:grid-cols-3">
          {cards.map(({ dashboard, thumbnail }) => (
            <li key={dashboard.slug}>
              <DashboardCard
                dashboard={dashboard}
                thumbnail={thumbnail}
                audience={t(`audience.${dashboard.audience}`)}
              />
            </li>
          ))}
        </ul>
      </Section>
    );
  } catch {
    return null;
  }
}

export async function LatestPublications() {
  const ctx = await context();
  const t = await getTranslations("Home");
  const lite = await isLite();
  try {
    const page = await api.publications(ctx);
    return (
      <Section
        title={t("publications")}
        className="border-t"
        aside={
          <Link href="/publications" className="text-primary font-semibold underline">
            {t("seeAll")}
          </Link>
        }
      >
        <ul className="grid gap-6 md:grid-cols-3">
          {page.items.slice(0, 3).map((item) => (
            <li key={item.slug} className="flex gap-4">
              {!lite && (
                <Image
                  src={item.coverUrl}
                  alt=""
                  width={96}
                  height={128}
                  loading="lazy"
                  unoptimized
                  className="aspect-[3/4] h-auto w-24 shrink-0 rounded-sm border object-cover"
                />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-muted-foreground text-xs font-semibold uppercase">
                  {t(`publicationType.${item.type}`)}
                </span>
                <Link href={`/publications/${item.slug}`} className="line-clamp-2 font-semibold">
                  {item.title}
                </Link>
                <span className="text-muted-foreground text-sm">
                  {formatDate(item.date, ctx.locale)}
                </span>
                <a
                  href={item.fileUrl}
                  className="text-primary mt-auto text-sm font-semibold underline"
                >
                  {t("downloadPdf", { size: formatBytes(item.fileBytes, ctx.locale) })}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Section>
    );
  } catch {
    return null;
  }
}

export async function LatestNews() {
  const ctx = await context();
  const t = await getTranslations("Home");
  try {
    const page = await api.news(ctx);
    return (
      <Section
        title={t("news")}
        className="border-t"
        aside={
          <Link href="/news" className="text-primary font-semibold underline">
            {t("seeAll")}
          </Link>
        }
      >
        <ul className="divide-y">
          {page.items.slice(0, 3).map((item) => (
            <li key={item.slug} className="py-4 first:pt-0">
              <p className="text-muted-foreground text-sm">
                {formatDate(item.date, ctx.locale)}
                {SEPARATOR}
                {item.tags[0]}
              </p>
              <h3 className="mt-1">
                <Link href={`/news/${item.slug}`}>{item.title}</Link>
              </h3>
              <p className="text-muted-foreground mt-1">{item.excerpt}</p>
            </li>
          ))}
        </ul>
      </Section>
    );
  } catch {
    return null;
  }
}

export async function DataPartners() {
  const ctx = await context();
  const t = await getTranslations("Home");
  try {
    const home = await api.home(ctx);
    return (
      <Section title={t("partners")} className="border-t">
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {home.partners.map((partner) => {
            const note = t("lastSubmission", {
              date: formatDate(partner.lastSubmission, ctx.locale),
            });
            return (
              <li
                key={partner.name}
                title={note}
                className="flex flex-col items-center gap-2 text-center"
              >
                <Image
                  src={partner.logo}
                  alt={partner.name}
                  width={120}
                  height={36}
                  unoptimized
                  className="grayscale transition-[filter] duration-(--onn-dur-2) hover:grayscale-0"
                />
                <span className="text-muted-foreground text-xs">{note}</span>
              </li>
            );
          })}
        </ul>
      </Section>
    );
  } catch {
    return null;
  }
}
