import type { ChartTokens } from "@onn/config/tokens";
import { formatPeriod, formatValue, unitIsInline } from "@onn/ui/format";
import type { EChartsOption, SeriesOption } from "echarts";
import type {
  BarSpec,
  ChartSpec,
  DonutSpec,
  LineSpec,
  RadarSpec,
  StackedSpec,
  TreemapSpec,
} from "./spec";

export interface BuildContext {
  tokens: ChartTokens;
  /** First render only, and never under reduced motion (brief §6). */
  animate: boolean;
  /** Presentation mode: light text on --onn-ink. */
  dark?: boolean;
}

const MAX_DONUT_SLICES = 6;
const MAX_END_LABEL_SERIES = 4;
const LONG_LABEL = 12;
const MAX_VERTICAL_BARS = 8;
const LABEL_FITS_PX = 40;
const TREEMAP_MIN_LABEL = { width: 60, height: 30 };
const FONT = "var(--onn-font-stack, system-ui), system-ui, sans-serif";
const ZERO_BASED_KINDS = new Set(["pct", "per100", "count", "pctGni", "pctGdp"]);

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function palette(ctx: BuildContext) {
  const { tokens, dark } = ctx;
  return {
    text: dark ? "#FFFFFF" : tokens.ink,
    muted: dark ? "#C9D1DC" : tokens.muted,
    line: dark ? "rgba(255,255,255,0.18)" : tokens.line,
    background: dark ? tokens.ink : tokens.surface,
  };
}

function base(ctx: BuildContext): EChartsOption {
  const colors = palette(ctx);
  return {
    backgroundColor: "transparent",
    color: ctx.tokens.categorical,
    textStyle: { fontFamily: FONT, color: colors.text, fontSize: 12 },
    animation: ctx.animate,
    animationDuration: 400,
    animationEasing: "cubicOut",
    animationDurationUpdate: 0,
    aria: { enabled: false },
  };
}

function formatter(spec: ChartSpec) {
  const inline = unitIsInline(spec.unitKind);
  return {
    value: (value: number | null) => formatValue(value, spec.unitKind, spec.tag),
    axis: (value: number) => formatValue(value, spec.unitKind, spec.tag, { compact: true }),
    withUnit: (value: number | null) => {
      const text = formatValue(value, spec.unitKind, spec.tag);
      return value === null || inline || !spec.unitLabel ? text : `${text} ${spec.unitLabel}`;
    },
  };
}

/** Counts and percentages start at zero unless the data spans under 10 % of its maximum. */
export function startsAtZero(kind: string, values: number[]) {
  if (!ZERO_BASED_KINDS.has(kind) || values.length === 0) return false;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return !(max > 0 && max - min < 0.1 * max);
}

export function linePeriods(spec: LineSpec) {
  const periods = new Set<string>();
  spec.series.forEach((series) => series.points.forEach((point) => periods.add(point.period)));
  spec.band?.points.forEach((point) => periods.add(point.period));
  return [...periods].sort();
}

function buildLine(spec: LineSpec, ctx: BuildContext): EChartsOption {
  const { tokens } = ctx;
  const colors = palette(ctx);
  const fmt = formatter(spec);
  const periods = linePeriods(spec);
  const labels = periods.map((period) => formatPeriod(period, spec.tag));
  const endLabels = spec.series.length <= MAX_END_LABEL_SERIES;
  const allValues = [
    ...spec.series.flatMap((s) => s.points.map((p) => p.value)),
    ...(spec.band?.points.flatMap((p) => [p.min, p.max]) ?? []),
  ].filter((value): value is number => value !== null);
  const statusOf = new Map<string, string>();

  let categoryIndex = 0;
  const series: SeriesOption[] = spec.series.map((line) => {
    const lookup = new Map(line.points.map((point) => [point.period, point]));
    const lastIndex = periods.findLastIndex((period) => lookup.get(period)?.value != null);
    const color =
      line.role === "focus"
        ? tokens.primary
        : line.role === "compare"
          ? tokens.compare
          : tokens.categorical[categoryIndex++ % tokens.categorical.length];
    const breaks: string[] = [];

    const data = periods.map((period, i) => {
      const point = lookup.get(period);
      if (point?.status) statusOf.set(`${line.name}|${period}`, point.status);
      if (point?.status === "B") breaks.push(labels[i] as string);
      const flagged = line.role === "focus" && (point?.status === "E" || point?.status === "P");
      const last = i === lastIndex;
      return {
        value: point?.value ?? null,
        symbol: flagged ? "emptyCircle" : last ? "circle" : "none",
        symbolSize: 8,
        label:
          last && line.role === "focus"
            ? {
                show: true,
                position: "top" as const,
                fontWeight: 600,
                color: colors.text,
                formatter: () => fmt.value(point?.value ?? null),
              }
            : undefined,
      };
    });

    return {
      type: "line",
      name: line.name,
      data,
      showSymbol: true,
      connectNulls: false,
      color,
      lineStyle: {
        width: line.role === "focus" ? 2.5 : 2,
        type: line.role === "compare" ? "dashed" : "solid",
        color,
      },
      itemStyle: { color, borderColor: color },
      emphasis: { focus: "series" },
      z: line.role === "focus" ? 3 : 2,
      endLabel: endLabels
        ? { show: true, formatter: line.name, color: colors.text, distance: 6 }
        : undefined,
      markLine: breaks.length
        ? {
            silent: true,
            symbol: "none",
            lineStyle: { type: "dashed", color: colors.muted },
            label: {
              formatter: spec.labels.breakInSeries,
              color: colors.muted,
              position: "insideEndTop",
            },
            data: breaks.map((xAxis) => ({ xAxis })),
          }
        : undefined,
    } satisfies SeriesOption;
  });

  if (spec.band) {
    const lookup = new Map(spec.band.points.map((point) => [point.period, point]));
    const common = { type: "line" as const, stack: "band", symbol: "none", silent: true, z: 1 };
    series.unshift(
      {
        ...common,
        id: "band-min",
        name: spec.band.name,
        data: periods.map((period) => lookup.get(period)?.min ?? null),
        lineStyle: { opacity: 0 },
      },
      {
        ...common,
        id: "band-range",
        name: spec.band.name,
        data: periods.map((period) => {
          const point = lookup.get(period);
          return point ? point.max - point.min : null;
        }),
        lineStyle: { opacity: 0 },
        areaStyle: { color: tokens.primary, opacity: 0.12 },
      },
    );
  }

  return {
    ...base(ctx),
    grid: {
      left: 8,
      right: endLabels ? 112 : 16,
      top: 28,
      bottom: endLabels ? 8 : 40,
      containLabel: true,
    },
    legend: endLabels
      ? { show: false }
      : {
          show: true,
          bottom: 0,
          type: "scroll",
          textStyle: { color: colors.text },
          data: spec.series.map((s) => s.name),
        },
    tooltip: {
      trigger: "axis",
      confine: true,
      formatter: (params: unknown) => {
        const items = params as {
          seriesId?: string;
          seriesName: string;
          value: number | null;
          dataIndex: number;
          color: string;
        }[];
        const index = items[0]?.dataIndex ?? 0;
        const period = periods[index] as string;
        const rows = items
          .filter((item) => item.seriesId !== "band-min" && item.seriesId !== "band-range")
          .map((item) => {
            const status = statusOf.get(`${item.seriesName}|${period}`);
            const note =
              status && status !== "A"
                ? ` (${spec.labels.status[status as keyof typeof spec.labels.status] ?? status})`
                : "";
            return `<div><span style="color:${item.color}">●</span> ${escapeHtml(item.seriesName)}: <b>${escapeHtml(fmt.withUnit(item.value))}</b>${escapeHtml(note)}</div>`;
          });
        const band = spec.band?.points.find((point) => point.period === period);
        if (band) {
          rows.push(
            `<div>${escapeHtml(spec.band!.name)} ${escapeHtml(spec.labels.range)}: ${escapeHtml(fmt.value(band.min))} – ${escapeHtml(fmt.value(band.max))}</div>`,
          );
        }
        return `<div style="font-weight:600">${escapeHtml(labels[index] ?? "")}</div>${rows.join("")}`;
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: colors.line } },
      axisTick: { show: false },
      axisLabel: { color: colors.muted, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      ...(spec.rank
        ? { inverse: true, min: 1, minInterval: 1 }
        : {
            min: startsAtZero(spec.unitKind, allValues) ? 0 : undefined,
            scale: !startsAtZero(spec.unitKind, allValues),
          }),
      axisLabel: { color: colors.muted, formatter: (value: number) => fmt.axis(value) },
      splitLine: { lineStyle: { color: colors.line } },
    },
    series,
  };
}

/** Horizontal when labels are long or there are more than 8 items (brief §6). */
export function barIsHorizontal(spec: BarSpec) {
  return (
    spec.items.length > MAX_VERTICAL_BARS ||
    spec.items.some((item) => item.label.length > LONG_LABEL)
  );
}

function buildBar(spec: BarSpec, ctx: BuildContext): EChartsOption {
  const { tokens } = ctx;
  const colors = palette(ctx);
  const fmt = formatter(spec);
  const horizontal = barIsHorizontal(spec);
  const max = Math.max(0, ...spec.items.map((item) => item.value ?? 0));
  const plot = (spec.width ?? 640) * (horizontal ? 0.55 : 0.8);

  const data = spec.items.map((item) => {
    const fits = max > 0 && ((item.value ?? 0) / max) * plot >= LABEL_FITS_PX;
    const fill = item.focus ? tokens.primary : tokens.compare;
    return {
      value: item.value,
      itemStyle: { color: fill, borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0] },
      label: {
        show: item.value !== null,
        position: (fits
          ? horizontal
            ? "insideRight"
            : "insideTop"
          : horizontal
            ? "right"
            : "top") as "insideRight" | "insideTop" | "right" | "top",
        color: fits ? (item.focus ? tokens.onPrimary : tokens.ink) : colors.text,
        fontWeight: item.focus ? 700 : 400,
        formatter: () => fmt.value(item.value),
      },
    };
  });

  const category = {
    type: "category" as const,
    data: spec.items.map((item) => item.label),
    inverse: horizontal,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: colors.line } },
    axisLabel: { color: colors.text, width: horizontal ? 140 : 80, overflow: "truncate" as const },
  };
  const value = {
    type: "value" as const,
    min: 0,
    axisLabel: { color: colors.muted, formatter: (v: number) => fmt.axis(v) },
    splitLine: { lineStyle: { color: colors.line } },
  };

  return {
    ...base(ctx),
    grid: { left: 8, right: 48, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (p: unknown) => {
        const item = p as { name: string; value: number | null };
        return `${escapeHtml(item.name)}: <b>${escapeHtml(fmt.withUnit(item.value))}</b>`;
      },
    },
    xAxis: horizontal ? value : category,
    yAxis: horizontal ? category : value,
    series: [
      {
        type: "bar",
        data,
        barMaxWidth: 28,
        markLine:
          spec.median !== undefined
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { type: "dashed", color: colors.text, width: 1.5 },
                // At the top of the line on horizontal bars, clear of the value axis labels.
                label: {
                  formatter: spec.labels.median,
                  color: colors.text,
                  position: horizontal ? "start" : "end",
                },
                data: [horizontal ? { xAxis: spec.median } : { yAxis: spec.median }],
              }
            : undefined,
      },
    ],
  };
}

export function stackedValues(spec: StackedSpec) {
  if (spec.mode === "absolute") return spec.series.map((series) => series.values);
  const totals = spec.categories.map((_, i) =>
    spec.series.reduce((sum, series) => sum + (series.values[i] ?? 0), 0),
  );
  return spec.series.map((series) =>
    series.values.map((value, i) =>
      value === null || !totals[i] ? null : Math.round((value / totals[i]!) * 1000) / 10,
    ),
  );
}

function buildStacked(spec: StackedSpec, ctx: BuildContext): EChartsOption {
  const { tokens } = ctx;
  const colors = palette(ctx);
  const percent = spec.mode === "percent";
  const fmt = percent
    ? {
        value: (v: number | null) => formatValue(v, "pct", spec.tag),
        axis: (v: number) => formatValue(v, "pct", spec.tag),
      }
    : formatter(spec);
  const values = stackedValues(spec);
  return {
    ...base(ctx),
    grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
    legend: { bottom: 0, type: "scroll", textStyle: { color: colors.text } },
    tooltip: {
      trigger: "axis",
      confine: true,
      valueFormatter: (v) => fmt.value(v as number | null),
    },
    xAxis: {
      type: "category",
      data: spec.categories,
      axisTick: { show: false },
      axisLabel: { color: colors.text },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: percent ? 100 : undefined,
      axisLabel: { color: colors.muted, formatter: (v: number) => fmt.axis(v) },
      splitLine: { lineStyle: { color: colors.line } },
    },
    series: spec.series.map((series, i) => ({
      type: "bar",
      name: series.name,
      stack: "total",
      data: values[i],
      itemStyle: {
        color: tokens.categorical[i % tokens.categorical.length],
        borderColor: tokens.categoricalBorder[i % tokens.categoricalBorder.length],
        borderWidth: 1,
      },
    })),
  };
}

/** At most 6 slices: the top 5 and the rest as "Other" (brief §6). */
export function donutSlices(spec: DonutSpec) {
  const sorted = [...spec.items].sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_DONUT_SLICES) return sorted;
  const kept = sorted.slice(0, MAX_DONUT_SLICES - 1);
  const rest = sorted.slice(MAX_DONUT_SLICES - 1).reduce((sum, item) => sum + item.value, 0);
  return [...kept, { label: spec.labels.other, value: rest }];
}

function buildDonut(spec: DonutSpec, ctx: BuildContext): EChartsOption {
  const { tokens } = ctx;
  const colors = palette(ctx);
  const fmt = formatter(spec);
  const slices = donutSlices(spec);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return {
    ...base(ctx),
    title: {
      text: fmt.value(total),
      subtext: spec.labels.total,
      left: "center",
      top: "center",
      textStyle: { fontSize: 22, fontWeight: 600, color: colors.text, fontFamily: FONT },
      subtextStyle: { color: colors.muted, fontFamily: FONT },
    },
    tooltip: {
      trigger: "item",
      confine: true,
      formatter: (p: unknown) => {
        const item = p as { name: string; value: number; percent: number };
        return `${escapeHtml(item.name)}: <b>${escapeHtml(fmt.withUnit(item.value))}</b> (${escapeHtml(formatValue(item.percent, "pct", spec.tag))})`;
      },
    },
    series: [
      {
        type: "pie",
        radius: ["45%", "68%"],
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: "outside",
          color: colors.text,
          formatter: (p: unknown) => {
            const item = p as { name: string; percent: number };
            return `${item.name}\n${formatValue(item.percent, "pct", spec.tag)}`;
          },
        },
        labelLine: { show: true, length: 10, length2: 12 },
        data: slices.map((slice, i) => ({
          name: slice.label,
          value: slice.value,
          itemStyle: {
            color: tokens.categorical[i % tokens.categorical.length],
            borderColor: tokens.categoricalBorder[i % tokens.categoricalBorder.length],
            borderWidth: 1.5,
          },
        })),
      },
    ],
  };
}

function buildRadar(spec: RadarSpec, ctx: BuildContext): EChartsOption {
  const { tokens } = ctx;
  const colors = palette(ctx);
  return {
    ...base(ctx),
    legend: { bottom: 0, textStyle: { color: colors.text } },
    tooltip: { trigger: "item", confine: true },
    radar: {
      indicator: spec.axes.map((name) => ({ name, max: 100, min: 0 })),
      // Long axis names wrap instead of spilling past a narrow chart.
      axisName: { color: colors.text, width: 88, overflow: "break", lineHeight: 14 },
      radius: "58%",
      splitLine: { lineStyle: { color: colors.line } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: colors.line } },
    },
    series: [
      {
        type: "radar",
        data: spec.series.map((series) => {
          const color = series.role === "focus" ? tokens.primary : tokens.compare;
          return {
            name: series.name,
            value: series.values.map((value) => value ?? 0),
            symbol: "circle",
            symbolSize: 4,
            itemStyle: { color },
            lineStyle: { color, width: 2, type: series.role === "compare" ? "dashed" : "solid" },
            areaStyle: series.role === "focus" ? { color, opacity: 0.2 } : undefined,
          };
        }),
      },
    ],
  };
}

function buildTreemap(spec: TreemapSpec, ctx: BuildContext): EChartsOption {
  const { tokens } = ctx;
  const fmt = formatter(spec);
  return {
    ...base(ctx),
    tooltip: {
      confine: true,
      formatter: (p: unknown) => {
        const item = p as { name: string; value: number };
        return `${escapeHtml(item.name)}: <b>${escapeHtml(fmt.withUnit(item.value))}</b>`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: "100%",
        height: "100%",
        top: 0,
        left: 0,
        label: { show: true, color: tokens.ink, formatter: "{b}" },
        // Labels on tiles under 60×30 px are hidden; the tooltip still names them.
        labelLayout: (params: { rect: { width: number; height: number } }) =>
          params.rect.width < TREEMAP_MIN_LABEL.width ||
          params.rect.height < TREEMAP_MIN_LABEL.height
            ? { fontSize: 0 }
            : {},
        data: spec.items.map((item, i) => ({
          name: item.label,
          value: item.value,
          itemStyle: {
            color: tokens.categorical[i % tokens.categorical.length],
            borderColor: tokens.surface,
            borderWidth: 2,
          },
          label: {
            color:
              i % tokens.categorical.length === 0 || i % tokens.categorical.length === 7
                ? "#FFFFFF"
                : tokens.ink,
          },
        })),
      },
    ],
  };
}

export function buildOption(spec: ChartSpec, ctx: BuildContext): EChartsOption {
  switch (spec.kind) {
    case "line":
      return buildLine(spec, ctx);
    case "bar":
      return buildBar(spec, ctx);
    case "stacked":
      return buildStacked(spec, ctx);
    case "donut":
      return buildDonut(spec, ctx);
    case "radar":
      return buildRadar(spec, ctx);
    case "treemap":
      return buildTreemap(spec, ctx);
  }
}
