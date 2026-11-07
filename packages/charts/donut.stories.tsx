import type { Meta, StoryObj } from "@storybook/react";
import { Chart } from "./chart";
import { donutSpec, frameLabels, source } from "./stories/fixtures";

const meta = {
  title: "Charts/Donut",
  component: Chart,
  args: {
    title: "Mobile subscriptions by operator",
    source,
    summary: "Operator 1 holds about half of all mobile subscriptions.",
    labels: frameLabels,
    spec: donutSpec,
  },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Seven operators: the smallest two are grouped as Other. */
export const Default: Story = {};

export const LongText: Story = {
  args: {
    spec: {
      ...donutSpec,
      items: donutSpec.items.map((item) => ({
        ...item,
        label: `${item.label} Telecommunications`,
      })),
    },
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
