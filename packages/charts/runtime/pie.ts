import { PieChart } from "echarts/charts";
import { TitleComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";

echarts.use([PieChart, TitleComponent, TooltipComponent, LabelLayout, SVGRenderer]);

export { echarts };
