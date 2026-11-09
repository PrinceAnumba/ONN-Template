// Checks that every component in brief §6 has a story for each required state.
// A state can be skipped only with a stated reason, and the skips are printed every run.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "packages");
const ALL = ["Default", "Loading", "Empty", "Error", "LongText", "Rtl", "Mobile"];

/** component → [story file, { state: reason it doesn't apply }] */
const COMPONENTS = {
  Button: ["ui/components/ui/button.stories.tsx", { Empty: "has no data", Error: "has no data" }],
  Combobox: [
    "ui/components/combobox.stories.tsx",
    { Loading: "options arrive with the page", Error: "options arrive with the page" },
  ],
  KpiCard: ["ui/components/kpi-card.stories.tsx", { Error: "the page or widget shows the error" }],
  ChartFrame: ["charts/chart.stories.tsx", {}],
  LineChart: [
    "charts/line-chart.stories.tsx",
    { Loading: "shown by ChartFrame", Empty: "shown by ChartFrame", Error: "shown by ChartFrame" },
  ],
  BarChart: [
    "charts/bar-chart.stories.tsx",
    { Loading: "shown by ChartFrame", Empty: "shown by ChartFrame", Error: "shown by ChartFrame" },
  ],
  StackedBar: [
    "charts/stacked-bar.stories.tsx",
    { Loading: "shown by ChartFrame", Empty: "shown by ChartFrame", Error: "shown by ChartFrame" },
  ],
  Donut: [
    "charts/donut.stories.tsx",
    { Loading: "shown by ChartFrame", Empty: "shown by ChartFrame", Error: "shown by ChartFrame" },
  ],
  Radar: [
    "charts/radar.stories.tsx",
    { Loading: "shown by ChartFrame", Empty: "shown by ChartFrame", Error: "shown by ChartFrame" },
  ],
  Treemap: [
    "charts/treemap.stories.tsx",
    { Loading: "shown by ChartFrame", Empty: "shown by ChartFrame", Error: "shown by ChartFrame" },
  ],
  TargetProgress: [
    "ui/components/target-progress.stories.tsx",
    { Loading: "rendered on the server with its data", Error: "the page shows the error" },
  ],
  ChoroplethMap: [
    "charts/choropleth.stories.tsx",
    { Loading: "the server SVG is the loading state", Error: "the page shows the error" },
  ],
  DataTable: [
    "ui/components/data-table.stories.tsx",
    { Error: "the page or widget shows the error" },
  ],
  MetadataDrawer: [
    "ui/components/metadata-drawer.stories.tsx",
    {
      Loading: "opens with data already loaded",
      Empty: "an indicator always has metadata",
      Error: "opens with data already loaded",
    },
  ],
  Drawer: [
    "ui/components/drawer.stories.tsx",
    { Loading: "content decides", Empty: "content decides", Error: "content decides" },
  ],
  BottomSheet: [
    "ui/components/bottom-sheet.stories.tsx",
    { Loading: "content decides", Empty: "content decides", Error: "content decides" },
  ],
  YearSlider: [
    "ui/components/year-slider.stories.tsx",
    {
      Loading: "has no data",
      Empty: "has no data",
      Error: "has no data",
      LongText: "shows years only",
    },
  ],
  DisaggregationTabs: [
    "ui/components/disaggregation-tabs.stories.tsx",
    { Loading: "has no data", Error: "has no data" },
  ],
  Toast: [
    "ui/components/toast.stories.tsx",
    { Loading: "has no data", Empty: "shows nothing when empty" },
  ],
  DemoRibbon: [
    "ui/components/demo-ribbon.stories.tsx",
    { Loading: "static", Empty: "static", Error: "static" },
  ],
  LiteModeToggle: [
    "ui/components/lite-mode-toggle.stories.tsx",
    { Loading: "has no data", Empty: "has no data", Error: "has no data" },
  ],
  CodeInput: ["ui/components/code-input.stories.tsx", {}],
  StatusPill: [
    "ui/components/status-pill.stories.tsx",
    {
      Loading: "a label has no loading state",
      Empty: "always has a label",
      Error: "a label has no error state",
    },
  ],
  BulkActionBar: [
    "ui/components/bulk-action-bar.stories.tsx",
    {
      Loading: "actions run on the page, which shows progress",
      Error: "the page reports a failed action",
    },
  ],
  EmptyState: [
    "ui/components/empty-state.stories.tsx",
    {
      Loading: "shown only once data has loaded",
      Empty: "is the empty state",
      Error: "the page shows errors",
    },
  ],
  StatusStepper: [
    "ui/components/status-stepper.stories.tsx",
    {
      Loading: "renders with the page",
      Empty: "always has steps",
      Error: "has no data of its own",
    },
  ],
  EntryGrid: [
    "ui/components/entry-grid.stories.tsx",
    {
      Loading: "the page loads the sheet before showing the grid",
      Error: "cell errors are in Default; load errors are the page’s",
    },
  ],
  FileDrop: [
    "ui/components/file-drop.stories.tsx",
    { Empty: "is the default state, before a file is chosen" },
  ],
};
let missing = 0;
const skipped = [];
for (const [name, [file, exempt]] of Object.entries(COMPONENTS)) {
  let source = "";
  try {
    source = readFileSync(join(root, file), "utf8");
  } catch {
    console.log(`MISSING FILE  ${name}: ${file}`);
    missing += 1;
    continue;
  }
  for (const state of ALL) {
    if (exempt[state]) {
      skipped.push(`${name}.${state}: ${exempt[state]}`);
      continue;
    }
    if (!new RegExp(`export const ${state}\\b`).test(source)) {
      console.log(`MISSING STATE ${name}.${state}`);
      missing += 1;
    }
  }
}
console.log(
  `\n${Object.keys(COMPONENTS).length} components checked; ${skipped.length} states skipped with a reason:`,
);
for (const line of skipped) console.log(`  - ${line}`);
console.log(missing ? `\n${missing} missing` : "\nAll required states have stories.");
process.exit(missing ? 1 : 0);
