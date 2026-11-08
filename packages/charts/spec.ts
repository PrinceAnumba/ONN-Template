// Serialisable chart descriptions. The server renders them to SVG and the client builds the same
// ECharts option from them, so no function ever crosses the server/client boundary.
import type { ObsStatus } from "@onn/api-client/types";

export interface BaseSpec {
  /** BCP 47 tag from config.numberFormat, e.g. "fr-SN". */
  tag: string;
  /** Unit variant code, used to format values (see packages/ui/format.ts). */
  unitKind: string;
  /** Shown after values that don't carry their unit. */
  unitLabel?: string;
}

export interface LinePoint {
  period: string;
  value: number | null;
  status?: ObsStatus;
}

export interface LineSeries {
  name: string;
  /** focus: the selected area; compare: the comparison; category: one disaggregation value. */
  role: "focus" | "compare" | "category";
  points: LinePoint[];
}

export interface LineSpec extends BaseSpec {
  kind: "line";
  series: LineSeries[];
  /** Values are ranks: the axis runs from 1 at the top, in whole steps (benchmark slope chart). */
  rank?: boolean;
  /** Peer group min–max band, drawn behind the median. */
  band?: { name: string; points: { period: string; min: number; max: number }[] };
  labels: {
    period: string;
    breakInSeries: string;
    range: string;
    status: Partial<Record<ObsStatus, string>>;
  };
}

export interface BarItem {
  label: string;
  value: number | null;
  focus?: boolean;
}

export interface BarSpec extends BaseSpec {
  kind: "bar";
  items: BarItem[];
  median?: number;
  /** Approximate plot width, used to decide whether a value label fits inside its bar. */
  width?: number;
  labels: { category: string; value: string; median: string };
}

export interface StackedSpec extends BaseSpec {
  kind: "stacked";
  categories: string[];
  series: { name: string; values: (number | null)[] }[];
  mode: "absolute" | "percent";
  labels: { category: string };
}

export interface DonutSpec extends BaseSpec {
  kind: "donut";
  items: { label: string; value: number }[];
  labels: { other: string; total: string; category: string; value: string };
}

export interface RadarSpec extends BaseSpec {
  kind: "radar";
  axes: string[];
  series: { name: string; role: "focus" | "compare"; values: (number | null)[] }[];
  labels: { axis: string };
}

export interface TreemapSpec extends BaseSpec {
  kind: "treemap";
  items: { label: string; value: number }[];
  labels: { category: string; value: string };
}

export type ChartSpec = LineSpec | BarSpec | StackedSpec | DonutSpec | RadarSpec | TreemapSpec;
export type ChartKind = ChartSpec["kind"];

/** Exactly what is plotted: drives the hidden table, "View as table" and CSV export. */
export interface ChartTable {
  columns: string[];
  rows: (string | number | null)[][];
  /** Which columns hold numbers, for formatting and alignment. */
  numeric: boolean[];
}
