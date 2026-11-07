import type { Meta, StoryObj } from "@storybook/react";
import { Chart } from "./chart";
import { categoryLineSpec, frameLabels, lineSpec, source } from "./stories/fixtures";

const meta = {
  title: "Charts/LineChart",
  component: Chart,
  args: {
    title: "Internet users",
    source,
    summary: "Internet users in Senegal rose from 21 % in 2015 to 68 % in 2025.",
    labels: frameLabels,
    spec: lineSpec,
  },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Focus, dashed comparison, peer band, a gap, an estimate, a break and a provisional point. */
export const Default: Story = {};

export const FocusOnly: Story = {
  args: { spec: { ...lineSpec, band: undefined, series: lineSpec.series.slice(0, 1) } },
};

/** More than four series: a legend replaces the end labels. */
export const Disaggregated: Story = {
  args: { title: "Internet users by group", spec: categoryLineSpec },
};

export const LongText: Story = {
  args: {
    title: "Internet users among people aged 15 and over in rural households",
    spec: {
      ...lineSpec,
      series: lineSpec.series.map((series, i) => ({
        ...series,
        name: i === 0 ? "Senegal, national total" : "Economic Community of West African States",
      })),
    },
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
