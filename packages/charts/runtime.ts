// Client runtime: each chart kind registers only what it needs, so a page with a line chart
// loads ECharts core + line (brief §9 budgets) and nothing else.
import type { ChartKind } from "./spec";

export type EChartsCore = typeof import("echarts/core");

const loaders: Record<ChartKind, () => Promise<EChartsCore>> = {
  line: () => import("./runtime/line").then((m) => m.echarts),
  bar: () => import("./runtime/bar").then((m) => m.echarts),
  stacked: () => import("./runtime/bar").then((m) => m.echarts),
  donut: () => import("./runtime/pie").then((m) => m.echarts),
  radar: () => import("./runtime/radar").then((m) => m.echarts),
  treemap: () => import("./runtime/treemap").then((m) => m.echarts),
};

export function loadRuntime(kind: ChartKind) {
  return loaders[kind]();
}
