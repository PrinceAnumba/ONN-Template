import type { Meta, StoryObj } from "@storybook/react";
import { Chart } from "./chart";
import { frameLabels, source, treemapSpec } from "./stories/fixtures";

const meta = {
  title: "Charts/Treemap",
  component: Chart,
  args: {
    title: "Mobile broadband subscriptions by operator",
    source,
    summary: "Three operators hold almost all mobile broadband subscriptions.",
    labels: frameLabels,
    spec: treemapSpec,
  },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The two smallest tiles are under 60×30 px, so their labels move to the tooltip. */
export const Default: Story = {};

export const LongText: Story = {
  args: {
    spec: {
      ...treemapSpec,
      items: treemapSpec.items.map((item) => ({
        ...item,
        label: `${item.label} Telecommunications`,
      })),
    },
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
