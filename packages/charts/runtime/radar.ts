import { RadarChart } from "echarts/charts";
import { LegendComponent, RadarComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";

echarts.use([
  RadarChart,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
  LabelLayout,
  SVGRenderer,
]);

export { echarts };
