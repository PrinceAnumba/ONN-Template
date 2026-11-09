import { ApiError, api, serverCache, type RequestContext } from "@onn/api-client";
import type { Benchmark, Indicator } from "@onn/api-client/types";
import { Chart } from "@onn/charts/chart";
import type { BarSpec, LineSpec } from "@onn/charts/spec";
import { country } from "@onn/config";
import { formatPeriod, formatValue, unitIsInline } from "@onn/ui/format";
import { cn } from "@onn/ui/lib/utils";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createLoader, type SearchParams } from "nuqs/server";
import { Link } from "@/i18n/navigation";
import { gapToMedian, nearestPeers, rankSeries } from "@/lib/benchmark";
import { chartFrameLabels, lineLabels } from "@/lib/chart-labels";
import { formatDate, tagFor } from "@/lib/format";
import { kindOf } from "@/lib/kpi";
import { isLite } from "@/lib/lite";
import { urlParsers } from "@/lib/url-state";

const loadParams = createLoader({ i: urlParsers.i, c: urlParsers.c });
const ROW_HEIGHT = 30;
const TONE = { good: "text-positive", bad: "text-negative", neutral: "text-muted-foreground" };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("benchmark") };
}

async function indicatorFor(code: string | undefined, ctx: RequestContext) {
  const fallback = async () => {
    const home = await api.home(ctx).catch(() => undefined);
    return home ? api.indicator(ctx, home.benchmarkIndicator) : undefined;
  };
  if (!code) return fallback();
  const indicator = await api.indicator(ctx, code).catch((error: unknown) => {
    // An unknown code falls back; the selector bar tells the visitor with a toast.
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  });
  return indicator ?? fallback();
}

/** Benchmark (brief §5.6): peer group tabs, ranked bars, rank slope chart and gap table. */
export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const locale = await getLocale();
  const tag = tagFor(locale);
  const state = await loadParams(searchParams);
  const code = state.i?.[0];
  const ctx: RequestContext = {
    locale,
    next: serverCache("benchmark", ...(code ? [`indicator:${code}`] : [])),
  };
  const [t, home, pages] = await Promise.all([
    getTranslations("Benchmark"),
    getTranslations("Home"),
    getTranslations("Pages"),
  ]);
  const groups = Object.entries(country.peers.groups).map(([key, group]) => ({
    key,
    name: group.name[locale] ?? key,
  }));
  const requested = state.c?.startsWith("peer:") ? state.c.slice(5) : null;
  const group =
    groups.find((item) => item.key === requested) ??
    groups.find((item) => item.key === country.peers.default)!;
  const countryName = country.name[locale] ?? country.iso3;
  const indicator = await indicatorFor(code, ctx);

  let benchmark: Benchmark | undefined;
  let failed = false;
  if (indicator) {
    benchmark = await api
      .benchmark(ctx, { indicator: indicator.code, group: group.key })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 404)) failed = true;
        return undefined;
      });
  }

  const header = (
    <>
      <h1>{pages("benchmark")}</h1>
      {indicator && <p className="text-h3 mt-1 font-normal">{indicator.name}</p>}
      <nav aria-label={t("groups")} className="mt-5">
        <ul className="flex flex-wrap gap-2">
          {groups.map((item) => {
            const active = item.key === group.key;
            const params = new URLSearchParams();
            if (code) params.set("i", code);
            if (item.key !== country.peers.default) params.set("c", `peer:${item.key}`);
            const query = params.toString();
            return (
              <li key={item.key}>
                <Link
                  href={`/benchmark${query ? `?${query}` : ""}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-pill flex min-h-11 items-center border px-4 text-sm",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-surface-2",
                  )}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );

  if (!indicator || !benchmark || !benchmark.rows.length) {
    const fallbackCode = (await api.home(ctx).catch(() => undefined))?.benchmarkIndicator;
    const fallbackIndicator =
      fallbackCode && fallbackCode !== indicator?.code
        ? await api.indicator(ctx, fallbackCode).catch(() => undefined)
        : undefined;
    return (
      <main id="content" className="onn-container py-8">
        {header}
        <div role={failed ? "alert" : undefined} className="bg-surface-2 mt-8 rounded-lg p-6">
          <p>{failed || !indicator ? t("error") : t("noPeers", { indicator: indicator.name })}</p>
          {fallbackIndicator && (
            <Link
              href={`/benchmark?i=${fallbackIndicator.code}`}
              className="text-primary mt-2 inline-block underline"
            >
              {t("tryDefault", { indicator: fallbackIndicator.name })}
            </Link>
          )}
        </div>
      </main>
    );
  }

  return (
    <main id="content" className="onn-container py-8">
      {header}
      <BenchmarkBlocks
        indicator={indicator}
        benchmark={benchmark}
        groupName={group.name}
        countryName={countryName}
        tag={tag}
      />
      <p className="text-muted-foreground mt-8 text-sm">
        {home("peerNote", { date: formatDate(benchmark.retrievedAt, locale) })}
      </p>
    </main>
  );
}

async function BenchmarkBlocks({
  indicator,
  benchmark,
  groupName,
  countryName,
  tag,
}: {
  indicator: Indicator;
  benchmark: Benchmark;
  groupName: string;
  countryName: string;
  tag: string;
}) {
  const t = await getTranslations("Benchmark");
  const [labels, lite] = await Promise.all([chartFrameLabels(), isLite()]);
  const kind = kindOf(indicator);
  const unitLabel = indicator.unitVariants[0]?.label ?? indicator.unit;
  const format = (value: number | null) => {
    const text = formatValue(value, kind, tag);
    return value === null || unitIsInline(kind) ? text : `${text} ${unitLabel}`;
  };
  const { rows } = benchmark;
  const year = rows[0]?.year ?? "";
  const median = benchmark.stats.find((stat) => stat.year === year)?.median;
  const focus = rows.find((row) => row.area === country.iso3);
  const ranked = rows.filter((row) => row.value !== null);

  const bars: BarSpec = {
    kind: "bar",
    tag,
    unitKind: kind,
    unitLabel,
    items: rows.map((row) => ({
      label: row.name,
      value: row.value,
      focus: row.area === country.iso3,
    })),
    median,
    labels: { category: t("economy"), value: t("value"), median: t("median") },
  };
  const peers = nearestPeers(rows, country.iso3);
  const history = rankSeries(benchmark.history, peers);
  const slope: LineSpec = {
    kind: "line",
    tag,
    unitKind: "count",
    rank: true,
    series: history.map((item) => ({
      name: item.name,
      role: item.area === country.iso3 ? "focus" : "category",
      points: item.points,
    })),
    labels: await lineLabels(),
  };
  const years = [...new Set(benchmark.history.map((row) => row.year))];

  return (
    <>
      {focus && (
        <p className="mt-6 max-w-prose text-lg">
          {t("headline", {
            country: countryName,
            rank: focus.rank,
            total: ranked.length,
            group: groupName,
            indicator: indicator.name,
            year: formatPeriod(year, tag),
          })}
        </p>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Chart
          lite={lite}
          spec={bars}
          title={t("rankedTitle", {
            indicator: indicator.name,
            group: groupName,
            year: formatPeriod(year, tag),
          })}
          subtitle={t("rankedSubtitle")}
          summary={t("rankedSummary", {
            items: ranked.map((row) => `${row.rank}. ${row.name} ${format(row.value)}`).join(", "),
            median: format(median ?? null),
          })}
          labels={labels}
          width={600}
          height={rows.length * ROW_HEIGHT + 60}
          mobileHeight={rows.length * ROW_HEIGHT + 60}
          fileName={`${indicator.code}-${groupName}`}
          logoUrl={country.brand.logo}
        />
        <Chart
          lite={lite}
          spec={slope}
          title={t("slopeTitle", { count: years.length })}
          subtitle={t("slopeSubtitle", { country: countryName })}
          summary={history
            .map((item) => {
              const last = [...item.points].reverse().find((point) => point.value !== null);
              return last
                ? t("rankSummary", { name: item.name, rank: last.value ?? 0, year: last.period })
                : "";
            })
            .filter(Boolean)
            .join(" ")}
          labels={labels}
          width={600}
          height={360}
          fileName={`${indicator.code}-${groupName}-rank`}
          logoUrl={country.brand.logo}
        />
      </div>

      <section aria-labelledby="benchmark-table" className="mt-10">
        <h2 id="benchmark-table">{t("tableTitle")}</h2>
        <div
          role="region"
          aria-labelledby="benchmark-table"
          // Scrollable region must be reachable by keyboard.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="mt-4 overflow-x-auto rounded-lg border"
        >
          <table className="w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th scope="col" className="p-3 text-start font-semibold">
                  {t("economy")}
                </th>
                <th scope="col" className="p-3 text-end font-semibold">
                  {t("value")}
                </th>
                <th scope="col" className="p-3 text-end font-semibold">
                  {t("year")}
                </th>
                <th scope="col" className="p-3 text-end font-semibold">
                  {t("rank")}
                </th>
                <th scope="col" className="p-3 text-end font-semibold">
                  {t("gap")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const gap = gapToMedian(row.value, median, indicator.higherIsBetter);
                const gapText = gap && formatValue(Math.abs(gap.gap), kind, tag);
                const isFocus = row.area === country.iso3;
                return (
                  <tr
                    key={row.area}
                    className={cn("border-t", isFocus && "bg-surface-2 font-semibold")}
                  >
                    <th scope="row" className="p-3 text-start font-[inherit]">
                      {row.name}
                    </th>
                    <td className="p-3 text-end tabular-nums">{format(row.value)}</td>
                    <td className="p-3 text-end tabular-nums">{formatPeriod(row.year, tag)}</td>
                    <td className="p-3 text-end tabular-nums">
                      {row.value === null ? formatValue(null, "count", tag) : row.rank}
                    </td>
                    <td className={cn("p-3 text-end tabular-nums", gap && TONE[gap.tone])}>
                      {gap && gapText ? (
                        <>
                          <span aria-hidden>
                            {gap.gap > 0 ? "+" : gap.gap < 0 ? "−" : ""}
                            {gapText}
                          </span>
                          <span className="sr-only">
                            {gap.gap > 0
                              ? t("above", { gap: gapText })
                              : gap.gap < 0
                                ? t("below", { gap: gapText })
                                : t("atMedian")}
                          </span>
                        </>
                      ) : (
                        formatValue(null, "count", tag)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
