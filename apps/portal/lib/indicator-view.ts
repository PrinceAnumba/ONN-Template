// Server-side loading for the indicator page and its embed (brief §5.3): reads the URL state,
// fetches the series and turns them into a chart spec, a text summary and table rows.
import { ApiError, api, serverCache, type RequestContext } from "@onn/api-client";
import type { Area, Indicator, Series } from "@onn/api-client/types";
import type { LineSeries, LineSpec } from "@onn/charts/spec";
import { country } from "@onn/config";
import { formatPeriod, formatValue, unitIsInline } from "@onn/ui/format";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createLoader, type SearchParams } from "nuqs/server";
import { lineLabels } from "./chart-labels";
import { formatDate, tagFor } from "./format";
import {
  categoryOf,
  endpoints,
  inRange,
  isSubnational,
  latestPoint,
  peerBand,
  selectedDisaggregation,
  selectedUnit,
  seriesTable,
  yearRange,
} from "./indicator";
import { getSelectorData } from "./selector-data";
import { urlParsers } from "./url-state";

const loadParams = createLoader(urlParsers);

export async function getIndicator(code: string, ctx: RequestContext) {
  return api.indicator(ctx, code).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
}

export interface IndicatorView {
  indicator: Indicator;
  locale: string;
  tag: string;
  state: Awaited<ReturnType<typeof loadParams>>;
  focus: Area;
  comparison: Area | null;
  areas: Area[];
  unit: { code: string; label: string };
  dimension: string | null;
  coverage: [number, number];
  range: [number, number];
  view: "chart" | "table" | "map";
  /** Total series for the focus area over all years, for the headline value. */
  focusTotal?: Series;
  spec: LineSpec;
  hasData: boolean;
  summary: string;
  source: string;
  /** Formats a value in the selected unit, adding the unit label when the number lacks it. */
  format: (value: number | null) => string;
  /** Query for the data download, matching what the page shows. */
  downloadQuery: { indicator: string; area: string; year?: string; dims?: string; unit?: string };
  ctx: RequestContext;
}

export async function loadIndicatorView(
  code: string,
  searchParams: Promise<SearchParams>,
  locale: string,
): Promise<IndicatorView> {
  const ctx: RequestContext = { locale, next: serverCache(`indicator:${code}`) };
  const [indicator, state, selector] = await Promise.all([
    getIndicator(code, ctx),
    loadParams(searchParams),
    getSelectorData(locale),
  ]);
  const t = await getTranslations("Indicator");
  const tag = tagFor(locale);
  const areas = selector.areas;
  const areaBy = (value: string | null) => areas.find((area) => area.code === value);

  const home: Area = areaBy(country.iso3) ?? {
    code: country.iso3,
    level: "country",
    name: country.name[locale] ?? country.iso3,
  };
  const focus = areaBy(state.a) ?? home;
  const comparison = state.c && state.c !== focus.code ? (areaBy(state.c) ?? null) : null;
  const unit = selectedUnit(state.u, indicator) ?? { code: "count", label: indicator.unit };
  const unitParam = unit.code === indicator.unitVariants[0]?.code ? undefined : unit.code;
  const dimension = selectedDisaggregation(state.d, indicator.disaggregations);
  const coverage: [number, number] = [
    Number(indicator.coverage.from.slice(0, 4)),
    Number(indicator.coverage.to.slice(0, 4)),
  ];
  const range = yearRange(state.y, coverage[0], coverage[1]);
  const subnational = isSubnational(indicator);
  const view = state.v === "map" && !subnational ? "chart" : (state.v ?? "chart");

  const format = (value: number | null) => {
    const text = formatValue(value, unit.code, tag);
    return value === null || unitIsInline(unit.code) ? text : `${text} ${unit.label}`;
  };
  const nameOf = (area: Area | null) => {
    if (!area) return "";
    return area.level === "group" ? t("peerMedian", { group: area.name }) : area.name;
  };
  const dimLabel = (value: string) =>
    t.has(`dimValues.${value}`) ? t(`dimValues.${value}` as "dimValues.female") : value;

  const comparisonCode = dimension ? undefined : comparison?.code;
  const group = comparison?.level === "group" ? comparison.code.replace(/^peer:/, "") : null;
  const [totals, categories, benchmark] = await Promise.all([
    api.series(ctx, {
      indicator: code,
      area: [focus.code, comparisonCode].filter(Boolean).join(","),
      unit: unitParam,
    }),
    dimension
      ? api.series(ctx, {
          indicator: code,
          area: focus.code,
          dims: `${dimension}:*`,
          unit: unitParam,
        })
      : Promise.resolve([] as Series[]),
    group && !dimension
      ? api.benchmark(ctx, { indicator: code, group }).catch(() => undefined)
      : Promise.resolve(undefined),
  ]);

  const isTotal = (series: Series) => Object.keys(series.dims).length === 0;
  const focusTotal = totals.find((series) => series.area === focus.code && isTotal(series));
  const comparisonTotal = comparisonCode
    ? totals.find((series) => series.area === comparisonCode && isTotal(series))
    : undefined;
  const clip = (series?: Series) =>
    (series?.points ?? []).filter((point) => inRange(point.period, range));

  const lines: LineSeries[] = dimension
    ? categories.map((series) => ({
        name: dimLabel(categoryOf(series.dims, dimension)),
        role: "category",
        points: clip(series),
      }))
    : [
        { name: focus.name, role: "focus", points: clip(focusTotal) },
        ...(comparison && comparisonTotal
          ? [{ name: nameOf(comparison), role: "compare" as const, points: clip(comparisonTotal) }]
          : []),
      ];
  const band = benchmark ? peerBand(benchmark.stats, range) : [];
  const spec: LineSpec = {
    kind: "line",
    tag,
    unitKind: unit.code,
    unitLabel: unit.label,
    series: lines,
    band: band.length && comparison ? { name: comparison.name, points: band } : undefined,
    labels: await lineLabels(),
  };
  const hasData = lines.some((line) => line.points.some((point) => point.value !== null));

  const period = (value: string) => formatPeriod(value, tag);
  const latestSentence = (line: LineSeries) => {
    const latest = latestPoint(
      line.points.map((point) => ({ ...point, status: point.status ?? "A" })),
    );
    return latest
      ? t("summaryLatest", {
          name: line.name,
          value: format(latest.value),
          period: period(latest.period),
        })
      : "";
  };
  let summary: string;
  if (!hasData) {
    summary = t("summaryNone", { area: focus.name });
  } else if (dimension) {
    summary = lines.map(latestSentence).filter(Boolean).join(" ");
  } else {
    const ends = endpoints(
      lines[0]?.points.map((point) => ({ ...point, status: point.status ?? "A" })) ?? [],
    );
    summary = ends
      ? t("summary", {
          indicator: indicator.name,
          area: focus.name,
          direction: ends.direction,
          first: format(ends.first.value),
          firstPeriod: period(ends.first.period),
          last: format(ends.last.value),
          lastPeriod: period(ends.last.period),
        })
      : t("summaryNone", { area: focus.name });
    if (lines[1]) summary = [summary, latestSentence(lines[1])].filter(Boolean).join(" ");
  }

  const source = t("source", {
    org: indicator.source.org,
    method: t(`method.${indicator.source.method}`),
    date: formatDate(indicator.lastUpdated, locale),
  });

  const year =
    range[0] === coverage[0] && range[1] === coverage[1] ? undefined : `${range[0]}-${range[1]}`;
  return {
    indicator,
    locale,
    tag,
    state,
    focus,
    comparison,
    areas,
    unit,
    dimension,
    coverage,
    range,
    view,
    focusTotal,
    spec,
    hasData,
    summary,
    source,
    format,
    downloadQuery: {
      indicator: code,
      area: [focus.code, comparisonCode].filter(Boolean).join(","),
      year,
      dims: dimension ? `${dimension}:*` : undefined,
      unit: unitParam,
    },
    ctx,
  };
}

/** Table rows: categories when disaggregated, else the focus, comparison and child areas. */
export async function loadIndicatorTable(view: IndicatorView) {
  const { indicator, focus, comparison, dimension, range, ctx, unit } = view;
  const unitParam = unit.code === indicator.unitVariants[0]?.code ? undefined : unit.code;
  const t = await getTranslations("Indicator");
  const clip = (series: Series) => series.points.filter((point) => inRange(point.period, range));

  if (dimension) {
    const series = await api.series(ctx, {
      indicator: indicator.code,
      area: focus.code,
      dims: `${dimension}:*`,
      unit: unitParam,
    });
    return seriesTable(
      series.map((item) => {
        const value = categoryOf(item.dims, dimension);
        return {
          id: value,
          name: t.has(`dimValues.${value}`) ? t(`dimValues.${value}` as "dimValues.female") : value,
          points: clip(item),
        };
      }),
    );
  }

  const children = isSubnational(indicator)
    ? view.areas.filter((area) => area.parent === focus.code && area.level !== "group")
    : [];
  const codes = [focus.code, comparison?.code, ...children.map((area) => area.code)].filter(
    (code): code is string => Boolean(code),
  );
  const series = await api.series(ctx, {
    indicator: indicator.code,
    area: codes.join(","),
    unit: unitParam,
  });
  const nameOf = (code: string) => {
    const area = view.areas.find((item) => item.code === code);
    if (!area) return code;
    return area.level === "group" ? t("peerMedian", { group: area.name }) : area.name;
  };
  return seriesTable(
    codes.flatMap((code) => {
      const match = series.find(
        (item) => item.area === code && Object.keys(item.dims).length === 0,
      );
      return match ? [{ id: code, name: nameOf(code), points: clip(match) }] : [];
    }),
  );
}

const hasValues = (points: { value: number | null }[]) =>
  points.some((point) => point.value !== null);

/**
 * Empty state for an area with no data (brief §8): the nearest area up the hierarchy that has
 * data, ending at the national level. Called only when the chart is empty, so it costs nothing
 * on a normal page view.
 */
export async function nearestAreaWithData(view: IndicatorView): Promise<Area | null> {
  const { indicator, focus, areas, ctx, unit } = view;
  const unitParam = unit.code === indicator.unitVariants[0]?.code ? undefined : unit.code;
  const chain: Area[] = [];
  let parent = focus.parent ? areas.find((area) => area.code === focus.parent) : undefined;
  while (parent && !chain.includes(parent)) {
    chain.push(parent);
    parent = parent.parent ? areas.find((area) => area.code === parent?.parent) : undefined;
  }
  const national = areas.find((area) => area.code === country.iso3);
  if (national && focus.code !== national.code && !chain.includes(national)) chain.push(national);

  for (const area of chain) {
    const series = await api
      .series(ctx, { indicator: indicator.code, area: area.code, unit: unitParam })
      .catch(() => [] as Series[]);
    const total = series.find((item) => Object.keys(item.dims).length === 0);
    if (total && hasValues(total.points)) return area;
  }
  return null;
}

/**
 * Breakdowns with no data for the focus area in the selected years (brief §8: that tab is
 * disabled with a tooltip). A failed request leaves the tab enabled; the view then shows its
 * own empty state.
 */
export async function unavailableBreakdowns(view: IndicatorView): Promise<string[]> {
  const { indicator, focus, range, ctx, unit, dimension, hasData } = view;
  const unitParam = unit.code === indicator.unitVariants[0]?.code ? undefined : unit.code;
  const checks = await Promise.all(
    indicator.disaggregations.map(async (key) => {
      if (key === dimension) return hasData ? null : key;
      const series = await api
        .series(ctx, {
          indicator: indicator.code,
          area: focus.code,
          dims: `${key}:*`,
          unit: unitParam,
        })
        .catch(() => null);
      if (!series) return null;
      const available = series.some((item) =>
        hasValues(item.points.filter((point) => inRange(point.period, range))),
      );
      return available ? null : key;
    }),
  );
  return checks.filter((key): key is string => key !== null);
}
