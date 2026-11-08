import { ChartFrame, type ChartFrameProps } from "./chart-frame";
import type { ChartSpec } from "./spec";
import { renderChartSvg } from "./ssr";
import { chartTable } from "./table";

const DESKTOP_WIDTH = 800;
const MOBILE_WIDTH = 360;

export type ChartProps = Omit<ChartFrameProps, "svg" | "table" | "spec"> & {
  spec?: ChartSpec;
  /** Server render width; match the column so text is not scaled down before hydration. */
  width?: number;
};

/**
 * Server-renders the chart at desktop and mobile sizes, then hands it to ChartFrame to hydrate.
 * Safe in Server Components: no hooks, and the spec is plain data.
 */
export function Chart({
  spec,
  height = 420,
  mobileHeight = 300,
  width = DESKTOP_WIDTH,
  ...props
}: ChartProps) {
  const ready = spec && (props.status ?? "ready") === "ready";
  const svg = ready
    ? {
        desktop: renderChartSvg(spec, { width, height }),
        mobile: renderChartSvg(spec, { width: MOBILE_WIDTH, height: mobileHeight }),
      }
    : undefined;
  return (
    <ChartFrame
      {...props}
      spec={spec}
      svg={svg}
      table={spec ? chartTable(spec) : undefined}
      height={height}
      mobileHeight={mobileHeight}
    />
  );
}
