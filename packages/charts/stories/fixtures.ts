// Synthetic data for stories, shaped like the mock API.
import type { ChartFrameLabels } from "../chart-frame";
import type { BarSpec, DonutSpec, LineSpec, RadarSpec, StackedSpec, TreemapSpec } from "../spec";

export const frameLabels: ChartFrameLabels = {
  download: "Download",
  png: "PNG image",
  svg: "SVG image",
  csv: "CSV data",
  share: "Share",
  embed: "Embed",
  viewTable: "View as table",
  hideTable: "Hide table",
  copied: "Copied to clipboard",
  error: "Couldn't load this chart.",
  retry: "Try again",
  empty: "No data for Dakar yet.",
};

const years = Array.from({ length: 11 }, (_, i) => String(2015 + i));
const curve = (from: number, to: number, i: number) =>
  Math.round((from + (to - from) * (i / 10) ** 0.9) * 10) / 10;

export const lineSpec: LineSpec = {
  kind: "line",
  tag: "en-SN",
  unitKind: "pct",
  series: [
    {
      name: "Senegal",
      role: "focus",
      points: years.map((period, i) => ({
        period,
        value: i === 4 ? null : curve(21, 68, i),
        status: i === 6 ? "B" : i === 3 ? "E" : i === 10 ? "P" : i === 4 ? "M" : "A",
      })),
    },
    {
      name: "ECOWAS median",
      role: "compare",
      points: years.map((period, i) => ({ period, value: curve(18, 52, i) })),
    },
  ],
  band: {
    name: "ECOWAS",
    points: years.map((period, i) => ({ period, min: curve(6, 25, i), max: curve(30, 81, i) })),
  },
  labels: {
    period: "Year",
    breakInSeries: "Break in series",
    range: "range",
    status: { E: "Estimate", P: "Provisional", B: "Break in series", M: "Missing" },
  },
};

export const categoryLineSpec: LineSpec = {
  ...lineSpec,
  band: undefined,
  series: ["Female", "Male", "Urban", "Rural", "15-24"].map((name, s) => ({
    name,
    role: "category" as const,
    points: years.map((period, i) => ({ period, value: curve(12 + s * 6, 50 + s * 7, i) })),
  })),
};

const economies = [
  ["Cabo Verde", 78.4],
  ["Ghana", 69.8],
  ["Senegal", 67.1],
  ["Côte d'Ivoire", 64.2],
  ["Nigeria", 59.9],
  ["Gambia", 53.0],
  ["Togo", 49.5],
  ["Benin", 44.1],
  ["Guinea", 38.6],
  ["Liberia", 33.2],
  ["Sierra Leone", 30.4],
  ["Niger", 3.9],
] as const;

export const barSpec: BarSpec = {
  kind: "bar",
  tag: "en-SN",
  unitKind: "pct",
  items: economies.map(([label, value]) => ({ label, value, focus: label === "Senegal" })),
  median: 51.5,
  labels: { category: "Economy", value: "Internet users", median: "Median" },
};

export const shortBarSpec: BarSpec = {
  ...barSpec,
  median: undefined,
  items: [
    { label: "Female", value: 61.2 },
    { label: "Male", value: 72.4, focus: true },
  ],
};

export const stackedSpec: StackedSpec = {
  kind: "stacked",
  tag: "en-SN",
  unitKind: "count",
  categories: ["2021", "2022", "2023", "2024", "2025"],
  series: [
    { name: "15-24", values: [410, 470, 520, 580, 640] },
    { name: "25-34", values: [380, 420, 450, 500, 540] },
    { name: "35-54", values: [290, 320, 360, 400, 430] },
    { name: "55+", values: [90, 110, 130, 150, 170] },
  ],
  mode: "absolute",
  labels: { category: "Year" },
};

export const donutSpec: DonutSpec = {
  kind: "donut",
  tag: "en-SN",
  unitKind: "count",
  items: [
    { label: "Operator 1", value: 9_100_000 },
    { label: "Operator 2", value: 5_800_000 },
    { label: "Operator 3", value: 3_200_000 },
    { label: "Operator 4", value: 420_000 },
    { label: "MVNO A", value: 160_000 },
    { label: "MVNO B", value: 90_000 },
    { label: "MVNO C", value: 40_000 },
  ],
  labels: { other: "Other", total: "Subscriptions", category: "Operator", value: "Subscriptions" },
};

export const radarSpec: RadarSpec = {
  kind: "radar",
  tag: "en-SN",
  unitKind: "score",
  axes: [
    "Connectivity",
    "Access",
    "Markets",
    "Affordability",
    "Skills",
    "Trust",
    "Governance",
    "Economy",
  ],
  series: [
    { name: "Senegal", role: "focus", values: [72, 64, 58, 61, 37, 74, 55, 49] },
    { name: "ECOWAS median", role: "compare", values: [60, 52, 50, 48, 30, 51, 47, 41] },
  ],
  labels: { axis: "Pillar" },
};

export const treemapSpec: TreemapSpec = {
  kind: "treemap",
  tag: "en-SN",
  unitKind: "count",
  items: [
    { label: "Operator 1", value: 9_100_000 },
    { label: "Operator 2", value: 5_800_000 },
    { label: "Operator 3", value: 3_200_000 },
    { label: "Operator 4", value: 420_000 },
    { label: "MVNO A", value: 160_000 },
    { label: "MVNO B", value: 40_000 },
  ],
  labels: { category: "Operator", value: "Subscriptions" },
};

export const source = "Source: National ICT survey, survey. Last updated 15 October 2026.";
