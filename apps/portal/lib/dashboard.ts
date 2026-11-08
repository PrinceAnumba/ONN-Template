// Server-side widget building for dashboards (brief §5.5). Each widget becomes plain data: a chart
// spec, KPI or target props, map shapes or table rows. One failing widget becomes an error model,
// so it never blanks the dashboard (§8).
import { api, type RequestContext } from "@onn/api-client";
import type { IndicatorSummary, Series, Widget } from "@onn/api-client/types";
import { choropleth, type LegendClass } from "@onn/charts/classify";
import { projectShapes, type MapShapes } from "@onn/charts/map-shapes";
import type { ChartSpec, LineSeries } from "@onn/charts/spec";
import { chartTable } from "@onn/charts/table";
import { country } from "@onn/config";
import { chartTokens } from "@onn/config/tokens";
import type { KpiCardProps } from "@onn/ui/components/kpi-card";
import type { TargetProgressProps } from "@onn/ui/components/target-progress";
import type { WidgetTable } from "@onn/ui/components/widget-shell";
import { formatPeriod, formatValue, unitIsInline } from "@onn/ui/format";
import { getTranslations } from "next-intl/server";
import { lineLabels } from "./chart-labels";
import { tagFor } from "./format";
import { targetProgress } from "./home";
import {
  inRange,
  isSubnational,
  peerBand,
  seriesTable,
  type TableRow,
  yearRange,
} from "./indicator";
import { hasLatest, kindOf, kpiCardProps } from "./kpi";

const STACKED_PERIODS = 6;
const TABLE_PERIODS = 5;

export type WidgetBody =
  | { kind: "chart"; spec: ChartSpec; summary: string; toggle: boolean }
  | { kind: "kpi"; card: KpiCardProps }
  | { kind: "target"; props: TargetProgressProps }
  | {
      kind: "map";
      shapes: MapShapes;
      fills: Record<string, string | null>;
      tooltips: Record<string, string>;
      classes: LegendClass[];
      noData: number;
      unitKind: string;
      unitLabel: string;
      mapTitle: string;
    }
  | { kind: "table"; rows: TableRow[]; periods: string[]; unitKind: string; caption: string }
  | { kind: "text"; body: string }
  | { kind: "empty" }
  | { kind: "error" };

export interface WidgetModel {
  id: string;
  title: string;
  span: 1 | 2 | 3;
  body: WidgetBody;
  table?: WidgetTable;
  explorerHref?: string;
  source?: string;
}

interface Env {
  ctx: RequestContext;
  locale: string;
  /** The selector's focus area and comparison, used when a widget sets neither. */
  focus: string;
  comparison: string | null;
  areaNames: Map<string, string>;
}

/** Shared lookups, so several widgets on one dashboard make each call once. */
function lookups(env: Env) {
  const summaries = new Map<string, Promise<IndicatorSummary[]>>();
  return {
    summaries(area: string) {
      let entry = summaries.get(area);
      if (!entry) {
        entry = api.indicators(env.ctx, { area, pageSize: 200 }).then((page) => page.items);
        summaries.set(area, entry);
      }
      return entry;
    },
  };
}

export async function buildWidgets(widgets: Widget[], env: Env): Promise<WidgetModel[]> {
  const shared = lookups(env);
  const [t, home, labels] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Home"),
    lineLabels(),
  ]);
  const ind = await getTranslations("Indicator");
  const tag = tagFor(env.locale);
  const dimLabel = (value: string) =>
    ind.has(`dimValues.${value}`) ? ind(`dimValues.${value}` as "dimValues.female") : value;

  const build = async (widget: Widget): Promise<WidgetModel> => {
    const base = { id: widget.id, title: widget.title, span: widget.span };
    if (widget.type === "text") return { ...base, body: { kind: "text", body: widget.body ?? "" } };

    const code = widget.indicators[0];
    if (!code) return { ...base, body: { kind: "empty" } };
    const area = widget.area ?? env.focus;
    const all = await shared.summaries(area);
    const meta = all.find((item) => item.code === code);
    if (!meta) return { ...base, body: { kind: "empty" } };
    const kind = kindOf(meta);
    const unitLabel = meta.unitVariants[0]?.label ?? meta.unit;
    const format = (value: number | null) => {
      const text = formatValue(value, kind, tag);
      return value === null || unitIsInline(kind) ? text : `${text} ${unitLabel}`;
    };
    const query = area === country.iso3 ? "" : `?a=${encodeURIComponent(area)}`;
    const common = {
      ...base,
      explorerHref: `/${env.locale}/data/${code}${query}`,
      source: t("source", { org: meta.source.org }),
    };
    const coverage: [number, number] = [2000, 2100];
    const range = yearRange(widget.years ?? null, ...coverage);
    const clip = (series?: Series) =>
      (series?.points ?? []).filter((point) => inRange(point.period, range));

    /** View data and CSV for a chart: exactly what is plotted. */
    const chartWidget = (spec: ChartSpec, summary: string, toggle = false): WidgetModel => {
      const table = chartTable(spec);
      return {
        ...common,
        body: { kind: "chart", spec, summary, toggle },
        table: {
          ...table,
          display: table.rows.map((row) =>
            row.map((value, i) =>
              table.numeric[i] && typeof value === "number"
                ? formatValue(value, kind, tag)
                : value === null
                  ? formatValue(null, kind, tag)
                  : String(value),
            ),
          ),
        },
      };
    };
    const latestOf = (series: Series) =>
      [...series.points].reverse().find((point) => point.value !== null);

    switch (widget.type) {
      case "kpi": {
        if (!hasLatest(meta)) return { ...common, body: { kind: "empty" } };
        const card = kpiCardProps(meta, { tag, href: common.explorerHref, t: home });
        return {
          ...common,
          body: { kind: "kpi", card },
          table: {
            columns: [t("columns.indicator"), t("columns.value"), t("columns.year")],
            rows: [[meta.name, meta.latest.value, meta.latest.year]],
            display: [[meta.name, format(meta.latest.value), card.year]],
            numeric: [false, true, false],
          },
        };
      }

      case "line": {
        const compare = widget.indicators.length === 1 ? (widget.compare ?? env.comparison) : null;
        const areas = [area, compare].filter(Boolean).join(",");
        const groups = await Promise.all(
          widget.indicators.map((indicator) =>
            api.series(env.ctx, { indicator, area: indicator === code ? areas : area }),
          ),
        );
        const total = (series: Series[], at: string) =>
          series.find((item) => item.area === at && Object.keys(item.dims).length === 0);
        const nameOf = (indicator: string) =>
          all.find((item) => item.code === indicator)?.name ?? indicator;
        const lines: LineSeries[] =
          widget.indicators.length > 1
            ? widget.indicators.map((indicator, i) => ({
                name: nameOf(indicator),
                role: "category",
                points: clip(total(groups[i] ?? [], area)),
              }))
            : [
                {
                  name: env.areaNames.get(area) ?? area,
                  role: "focus",
                  points: clip(total(groups[0] ?? [], area)),
                },
                ...(compare
                  ? [
                      {
                        name: compare.startsWith("peer:")
                          ? ind("peerMedian", { group: env.areaNames.get(compare) ?? compare })
                          : (env.areaNames.get(compare) ?? compare),
                        role: "compare" as const,
                        points: clip(total(groups[0] ?? [], compare)),
                      },
                    ]
                  : []),
              ];
        let band;
        if (compare?.startsWith("peer:")) {
          const stats = await api
            .benchmark(env.ctx, { indicator: code, group: compare.slice(5) })
            .then((result) => result.stats)
            .catch(() => []);
          const points = peerBand(stats, range);
          if (points.length) band = { name: env.areaNames.get(compare) ?? compare, points };
        }
        const spec: ChartSpec = {
          kind: "line",
          tag,
          unitKind: kind,
          unitLabel,
          series: lines,
          band,
          labels,
        };
        const summary = lines
          .map((line) => {
            const last = [...line.points].reverse().find((point) => point.value !== null);
            return last
              ? ind("summaryLatest", {
                  name: line.name,
                  value: format(last.value),
                  period: formatPeriod(last.period, tag),
                })
              : "";
          })
          .filter(Boolean)
          .join(" ");
        return chartWidget(spec, summary);
      }

      case "bar":
      case "donut":
      case "treemap":
      case "stacked": {
        const dim = Object.keys(widget.dims ?? {})[0];
        if (!dim) return { ...common, body: { kind: "empty" } };
        const series = await api.series(env.ctx, { indicator: code, area, dims: `${dim}:*` });
        if (!series.length) return { ...common, body: { kind: "empty" } };
        const items = series.map((item) => ({
          label: dimLabel(item.dims[dim] ?? ""),
          value: latestOf(item)?.value ?? null,
        }));
        const period = latestOf(series[0]!)?.period ?? "";
        const summary = t("summaryItems", {
          period: formatPeriod(period, tag),
          items: items.map((item) => `${item.label}: ${format(item.value)}`).join("; "),
        });
        if (widget.type === "bar") {
          return chartWidget(
            {
              kind: "bar",
              tag,
              unitKind: kind,
              unitLabel,
              items,
              labels: {
                category: t("columns.category"),
                value: t("columns.value"),
                median: t("median"),
              },
            },
            summary,
          );
        }
        const known = items.flatMap((item) =>
          item.value === null ? [] : [{ label: item.label, value: item.value }],
        );
        if (widget.type === "donut") {
          return chartWidget(
            {
              kind: "donut",
              tag,
              unitKind: kind,
              unitLabel,
              items: known,
              labels: {
                other: t("other"),
                total: t("total"),
                category: t("columns.category"),
                value: t("columns.value"),
              },
            },
            summary,
          );
        }
        if (widget.type === "treemap") {
          return chartWidget(
            {
              kind: "treemap",
              tag,
              unitKind: kind,
              unitLabel,
              items: known,
              labels: { category: t("columns.category"), value: t("columns.value") },
            },
            summary,
          );
        }
        const periods = [
          ...new Set(series.flatMap((item) => clip(item).map((point) => point.period))),
        ]
          .sort()
          .slice(-STACKED_PERIODS);
        return chartWidget(
          {
            kind: "stacked",
            tag,
            unitKind: kind,
            unitLabel,
            categories: periods.map((value) => formatPeriod(value, tag)),
            series: series.map((item) => ({
              name: dimLabel(item.dims[dim] ?? ""),
              values: periods.map(
                (value) => item.points.find((point) => point.period === value)?.value ?? null,
              ),
            })),
            mode: "absolute",
            labels: { category: t("columns.period") },
          },
          summary,
          true,
        );
      }

      case "radar": {
        const index = await api.index(env.ctx);
        const name = env.areaNames.get(area) ?? area;
        return chartWidget(
          {
            kind: "radar",
            tag,
            unitKind: "score",
            axes: index.pillars.map((pillar) => pillar.name),
            series: [{ name, role: "focus", values: index.pillars.map((pillar) => pillar.score) }],
            labels: { axis: t("columns.pillar") },
          },
          t("summaryItems", {
            period: index.year,
            items: index.pillars
              .map((pillar) => `${pillar.name}: ${formatValue(pillar.score, "score", tag)}`)
              .join("; "),
          }),
        );
      }

      case "map": {
        const [rows, topology, regions] = await Promise.all([
          api.latest(env.ctx, { indicator: code, level: "adm1" }),
          api.geometry(env.ctx, country.iso3, "adm1"),
          api.areas(env.ctx, { level: "adm1" }),
        ]);
        const values = Object.fromEntries(
          regions.map((region) => [region.code, null as number | null]),
        );
        rows.forEach((row) => (values[row.area] = row.value));
        const { fills, classes, noData } = choropleth(values, "quantile", chartTokens.sequential);
        const nameOf = (at: string) => regions.find((region) => region.code === at)?.name ?? at;
        const year = rows[0] ? formatPeriod(rows[0].period, tag) : "";
        return {
          ...common,
          explorerHref: `/${env.locale}/map?i=${code}`,
          body: {
            kind: "map",
            shapes: projectShapes(topology, country.geography.codeProperty, 640),
            fills,
            tooltips: Object.fromEntries(
              regions.map((region) => [
                region.code,
                `${region.name}: ${format(values[region.code] ?? null)}`,
              ]),
            ),
            classes,
            noData,
            unitKind: kind,
            unitLabel,
            mapTitle: ind("mapTitle", { indicator: meta.name, year }),
          },
          table: {
            columns: [t("columns.area"), t("columns.value")],
            rows: regions.map((region) => [nameOf(region.code), values[region.code] ?? null]),
            display: regions.map((region) => [
              nameOf(region.code),
              format(values[region.code] ?? null),
            ]),
            numeric: [false, true],
          },
        };
      }

      case "table": {
        const children = isSubnational(meta)
          ? (await api.areas(env.ctx, { parent: area })).map((child) => child.code)
          : [];
        const codes = [area, ...children];
        const series = await api.series(env.ctx, { indicator: code, area: codes.join(",") });
        const result = seriesTable(
          codes.flatMap((at) => {
            const match = series.find(
              (item) => item.area === at && Object.keys(item.dims).length === 0,
            );
            return match
              ? [{ id: at, name: env.areaNames.get(at) ?? at, points: match.points }]
              : [];
          }),
        );
        const periods = result.periods.slice(0, TABLE_PERIODS);
        return {
          ...common,
          body: {
            kind: "table",
            rows: result.rows,
            periods,
            unitKind: kind,
            caption: widget.title,
          },
          table: {
            columns: [t("columns.area"), ...periods.map((value) => formatPeriod(value, tag))],
            rows: result.rows.map((row) => [
              row.name,
              ...periods.map((value) => row.cells[value]?.value ?? null),
            ]),
            display: result.rows.map((row) => [
              row.name,
              ...periods.map((value) => formatValue(row.cells[value]?.value ?? null, kind, tag)),
            ]),
            numeric: [false, ...periods.map(() => true)],
          },
        };
      }

      case "target": {
        const strategy = await api.targets(env.ctx);
        const target = strategy.targets.find((item) => item.indicator === code);
        if (!target) return { ...common, body: { kind: "empty" } };
        const series = await api.series(env.ctx, { indicator: code, area: country.iso3 });
        const progress = targetProgress(
          series[0],
          target.target,
          target.targetYear,
          meta.higherIsBetter,
        );
        const caption = home("targetCaption", {
          current: format(progress.current),
          target: format(target.target),
          year: target.targetYear,
        });
        return {
          ...common,
          body: {
            kind: "target",
            props: {
              name: target.name,
              valueShare: progress.valueShare,
              targetShare: progress.targetShare,
              caption,
              status: progress.status,
              statusLabel: progress.status && home(`status.${progress.status}`),
            },
          },
          table: {
            columns: [
              t("columns.indicator"),
              t("columns.current"),
              t("columns.target"),
              t("columns.year"),
            ],
            rows: [[target.name, progress.current, target.target, target.targetYear]],
            display: [
              [target.name, format(progress.current), format(target.target), target.targetYear],
            ],
            numeric: [false, true, true, false],
          },
        };
      }
    }
    return { ...common, body: { kind: "empty" } };
  };

  return Promise.all(
    widgets.map((widget) =>
      build(widget).catch((): WidgetModel => ({
        id: widget.id,
        title: widget.title,
        span: widget.span,
        body: { kind: "error" },
      })),
    ),
  );
}
