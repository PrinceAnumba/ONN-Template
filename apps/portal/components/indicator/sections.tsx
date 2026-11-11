// Server parts of the indicator page (brief §5.3). The page loads the view once and hands it to
// these; the side column and map catch their own failures. Nothing streams, so the page reads
// without JavaScript.
import { api } from "@onn/api-client";
import { Chart } from "@onn/charts/chart";
import { country } from "@onn/config";
import { Sparkline } from "@onn/ui/components/sparkline";
import { describeChange, formatPeriod, formatValue, unitIsInline } from "@onn/ui/format";
import { cn } from "@onn/ui/lib/utils";
import {
  ArrowDownRightIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { chartFrameLabels } from "@/lib/chart-labels";
import { tagFor } from "@/lib/format";
import { flagsIn, latestPoint } from "@/lib/indicator";
import { loadIndicatorTable, type IndicatorView } from "@/lib/indicator-view";
import { MapExplorerLazy } from "@/components/map/map-explorer-lazy";
import { ClientMessages } from "@/components/shell/client-messages";
import { initialYear } from "@/lib/map";
import { loadMapData } from "@/lib/map-view";
import { isLite } from "@/lib/lite";
import { metadataProps } from "@/lib/metadata";
import { serializeUrlState } from "@/lib/url-state";
import type { Area } from "@onn/api-client/types";
import { FeedbackWidget } from "./feedback-widget";
import { IndicatorTable } from "./indicator-table";
import { MetadataButton } from "./metadata-button";
import { FallbackMark } from "@/components/fallback-mark";
import { fallbackLang } from "@/lib/localised";

const SEPARATOR = " · ";
const TONE = { good: "text-positive", bad: "text-negative", neutral: "text-muted-foreground" };
const ARROW = { up: ArrowUpRightIcon, down: ArrowDownRightIcon, flat: ArrowRightIcon };

/** Chart, table and map width at ≥ 1024 px, so the server SVG isn't scaled down. */
export const CHART_WIDTH = 640;

export async function IndicatorHeader({ view }: { view: IndicatorView }) {
  const { indicator, tag, focus } = view;
  const t = await getTranslations("Indicator");
  const home = await getTranslations("Home");
  const pillars = await api.pillars(view.ctx).catch(() => []);
  const pillar = pillars.find((item) => item.code === indicator.pillar);
  const theme = pillar?.themes.find((item) => item.code === indicator.theme);
  const itu = indicator.intlRefs.find((ref) => ref.org === "ITU");
  const latest = view.focusTotal ? latestPoint(view.focusTotal.points) : undefined;
  const change = latest && describeChange(latest.changePct, indicator.higherIsBetter);
  const changeText = latest && formatValue(Math.abs(latest.changePct ?? 0), "pct", tag);
  const Arrow = change && ARROW[change.direction];

  const { labels: metadata, display: displayOf } = await metadataProps();
  const display = displayOf(indicator);
  const chips = [view.unit.label, display.periodicity, indicator.source.org];

  return (
    <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <nav aria-label={t("breadcrumb")}>
          <ol className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
            <li>
              <Link href="/data" className="hover:text-foreground underline">
                {t("data")}
              </Link>
            </li>
            {[pillar?.name, theme?.name].filter(Boolean).map((name) => (
              <li key={name} className="flex items-center gap-1">
                <ChevronRightIcon aria-hidden className="size-4 rtl:rotate-180" />
                {name}
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 lang={fallbackLang(indicator)}>{indicator.name}</h1>
          <FallbackMark item={indicator} />
        </div>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          {chips.map((chip) => (
            <li key={chip} className="rounded-pill border px-3 py-1">
              {chip}
            </li>
          ))}
          {itu && (
            <li>
              <a
                href={itu.url}
                rel="noreferrer"
                className="rounded-pill text-primary inline-flex border px-3 py-1 underline"
              >
                {t("itu")}
                {SEPARATOR}
                {itu.code}
              </a>
            </li>
          )}
        </ul>
        <p lang={fallbackLang(indicator)} className="mt-3 line-clamp-2 max-w-prose">
          {indicator.shortDefinition}
        </p>
        <div className="mt-3">
          <MetadataButton
            indicator={indicator}
            display={display}
            labels={metadata}
            buttonLabel={t("fullMetadata")}
          />
        </div>
      </div>

      <div className="bg-surface-2 self-start rounded-lg p-5 lg:min-w-60 lg:text-end">
        {latest ? (
          <>
            <p className="text-sm">{t("latestFor", { area: focus.name })}</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 lg:justify-end">
              <span className="text-kpi">{formatValue(latest.value, view.unit.code, tag)}</span>
              {(latest.status === "E" || latest.status === "P") && (
                <sup className="text-muted-foreground text-xs">
                  {latest.status.toLowerCase()}
                  <span className="sr-only">{home(`flag.${latest.status}`)}</span>
                </sup>
              )}
              {!unitIsInline(view.unit.code) && (
                <span className="text-muted-foreground">{view.unit.label}</span>
              )}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{formatPeriod(latest.period, tag)}</p>
            {change && Arrow && changeText && (
              <p
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-sm font-semibold",
                  TONE[change.tone],
                )}
              >
                <Arrow aria-hidden className="size-4" />
                <span aria-hidden>{changeText}</span>
                <span className="sr-only">
                  {t(`change.${change.direction}`, { change: changeText })}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">{t("noLatest", { area: focus.name })}</p>
        )}
      </div>
    </header>
  );
}

/** "June 2026" for a `YYYY-MM` release, or null when none is scheduled. */
function releaseMonth(nextRelease: string | undefined, tag: string) {
  return nextRelease
    ? new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${nextRelease.slice(0, 7)}-01T00:00:00Z`),
      )
    : null;
}

/**
 * Empty state for an area without data (brief §8): says so, links to the nearest level that has
 * data with the rest of the URL state kept, and gives the release calendar date.
 */
export async function NoDataPanel({
  view,
  nearest,
}: {
  view: IndicatorView;
  nearest: Area | null;
}) {
  const t = await getTranslations("Indicator");
  const month = releaseMonth(view.indicator.nextRelease, tagFor(view.locale));
  const query = nearest
    ? serializeUrlState({ ...view.state, a: nearest.code === country.iso3 ? null : nearest.code })
    : "";
  return (
    <section aria-labelledby="no-data-title" className="bg-surface-2 rounded-lg p-6">
      <h2 id="no-data-title" className="text-h3">
        {t("noDataFor", { area: view.focus.name })}
      </h2>
      {nearest && (
        <p className="mt-3">
          <Link
            href={`/data/${view.indicator.code}${query}`}
            className="inline-flex min-h-11 items-center font-semibold underline"
          >
            {t("seeNearest", { area: nearest.name })}
          </Link>
        </p>
      )}
      <p className="text-muted-foreground mt-2">
        {month ? t("nextUpdate", { month }) : t("noRelease")}
      </p>
    </section>
  );
}

export async function ChartView({ view }: { view: IndicatorView }) {
  const t = await getTranslations("Indicator");
  const lite = await isLite();
  const years =
    view.range[0] === view.range[1] ? String(view.range[0]) : `${view.range[0]}–${view.range[1]}`;
  return (
    <div>
      <Chart
        spec={view.spec}
        status={view.hasData ? "ready" : "empty"}
        title={t("chartTitle", { indicator: view.indicator.name, area: view.focus.name })}
        subtitle={t("chartSubtitle", { years, unit: view.unit.label })}
        source={view.source}
        summary={view.summary}
        labels={await chartFrameLabels()}
        width={CHART_WIDTH}
        lite={lite}
        showShare={false}
        // Directly under the page h1, so the chart title is the first h2.
        headingLevel={2}
        fileName={view.indicator.code}
        logoUrl={country.brand.logo}
      />
      <p className="mt-3 max-w-prose">{view.summary}</p>
    </div>
  );
}

export async function TableView({ view }: { view: IndicatorView }) {
  const t = await getTranslations("Indicator");
  const status = await getTranslations("Chart");
  const table = await loadIndicatorTable(view);
  const flags = flagsIn(table.rows).map((flag) => ({
    status: flag,
    text: t("flagEntry", { symbol: flag.toLowerCase(), label: status(`status.${flag}`) }),
  }));
  return (
    <div>
      <IndicatorTable
        caption={t("tableCaption", { indicator: view.indicator.name, unit: view.unit.label })}
        rows={table.rows}
        periods={table.periods}
        rowHeader={view.dimension ? t("category") : t("area")}
        unitKind={view.unit.code}
        tag={view.tag}
        flags={flags}
        emptyLabel={status("empty")}
        sortLabel={t.raw("sortBy") as string}
      />
      <p className="text-muted-foreground mt-3 text-sm">{view.source}</p>
    </div>
  );
}

/** The map page's explorer, locked to this indicator and stacked in the main column. */
export async function MapView({ view }: { view: IndicatorView }) {
  const t = await getTranslations("Indicator");
  try {
    const data = await loadMapData({
      indicator: view.indicator,
      level: view.state.l,
      unit: view.unit,
      ctx: view.ctx,
      locale: view.locale,
    });
    return (
      <ClientMessages namespaces={["Map"]}>
        <MapExplorerLazy
          data={data}
          initialYear={initialYear(data.years, data.values, String(view.range[1]))}
          focus={view.focus.code}
          layout="stacked"
          heading="h2"
        />
      </ClientMessages>
    );
  } catch {
    return (
      <p role="alert" className="bg-surface-2 rounded-lg p-6">
        {t("mapUnavailable")}
      </p>
    );
  }
}

export async function IndicatorSide({ view }: { view: IndicatorView }) {
  const t = await getTranslations("Indicator");
  const { indicator, ctx, locale } = view;
  const tag = tagFor(locale);
  const related = await Promise.all(
    indicator.related.slice(0, 4).map((code) => api.indicator(ctx, code).catch(() => undefined)),
  );
  const month = releaseMonth(indicator.nextRelease, tag);

  return (
    <aside className="flex flex-col gap-8">
      {related.some(Boolean) && (
        <section>
          <h2 className="text-h3">{t("related")}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {related.map(
              (item) =>
                item && (
                  <li key={item.code}>
                    <Link
                      href={`/data/${item.code}`}
                      className="hover:bg-surface-2 flex items-center gap-3 rounded-md border p-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
                        {item.latest && (
                          <span className="text-muted-foreground text-xs">
                            {formatValue(
                              item.latest.value,
                              item.unitVariants[0]?.code ?? "count",
                              tag,
                            )}
                            {SEPARATOR}
                            {formatPeriod(item.latest.year, tag)}
                          </span>
                        )}
                      </span>
                      {item.latest && item.latest.sparkline.length > 1 && (
                        <Sparkline values={item.latest.sparkline} className="w-20 shrink-0" />
                      )}
                    </Link>
                  </li>
                ),
            )}
          </ul>
        </section>
      )}
      {indicator.dashboards.length > 0 && (
        <section>
          <h2 className="text-h3">{t("usedIn")}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {indicator.dashboards.map((dashboard) => (
              <li key={dashboard.slug}>
                <Link href={`/dashboards/${dashboard.slug}`} className="text-primary underline">
                  {dashboard.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-h3">{t("release")}</h2>
        <p className="mt-2">{month ? t("nextUpdate", { month }) : t("noRelease")}</p>
      </section>
      <section className="border-t pt-6">
        <FeedbackWidget
          page={`/data/${indicator.code}`}
          labels={{
            useful: t("useful"),
            yes: t("yes"),
            no: t("no"),
            comment: t("comment"),
            send: t("send"),
            thanks: t("thanks"),
            error: t("feedbackError"),
          }}
        />
      </section>
    </aside>
  );
}
