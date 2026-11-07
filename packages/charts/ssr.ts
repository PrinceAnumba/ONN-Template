// Server-side (and Storybook) SVG rendering. Registers every chart type: this module never
// ships to a page bundle that only hydrates.
import { chartTokens } from "@onn/config/tokens";
import { BarChart, LineChart, PieChart, RadarChart, TreemapChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";
import { buildOption } from "./options";
import type { ChartSpec } from "./spec";

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  RadarChart,
  TreemapChart,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  LabelLayout,
  SVGRenderer,
]);

/** Static SVG for no-JS and Lite mode. Width 100 % so it scales with its container. */
export function renderChartSvg(
  spec: ChartSpec,
  size: { width: number; height: number },
  dark = false,
) {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, ...size });
  chart.setOption(buildOption(spec, { tokens: chartTokens, animate: false, dark }));
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg.replace(/^<svg([^>]*?) width="\d+" height="\d+"/, '<svg$1 width="100%" height="100%"');
}
