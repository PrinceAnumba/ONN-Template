import type { Meta, StoryObj } from "@storybook/react";
import { Chart } from "./chart";
import { barSpec, frameLabels, shortBarSpec, source } from "./stories/fixtures";

const meta = {
  title: "Charts/BarChart",
  component: Chart,
  args: {
    title: "Internet users, ECOWAS, 2025",
    source,
    summary: "Senegal ranks 3rd of 12 ECOWAS economies, above the median of 51.5 %.",
    labels: frameLabels,
    spec: barSpec,
    height: 460,
    mobileHeight: 460,
  },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** RankedBars: more than 8 items, so horizontal, with the group median. */
export const Default: Story = {};

export const Vertical: Story = {
  args: { title: "Internet users by sex", spec: shortBarSpec, height: 320, mobileHeight: 300 },
};

export const LongText: Story = {
  args: {
    spec: {
      ...barSpec,
      items: barSpec.items.map((item) => ({ ...item, label: `${item.label} (national estimate)` })),
    },
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
