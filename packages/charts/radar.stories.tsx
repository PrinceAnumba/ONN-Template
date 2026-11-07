import type { Meta, StoryObj } from "@storybook/react";
import { Chart } from "./chart";
import { frameLabels, radarSpec, source } from "./stories/fixtures";

const meta = {
  title: "Charts/Radar",
  component: Chart,
  args: {
    title: "National index by pillar",
    source,
    summary: "Senegal scores above the ECOWAS median on every pillar, most on trust.",
    labels: frameLabels,
    spec: radarSpec,
  },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = {
  args: {
    spec: {
      ...radarSpec,
      axes: radarSpec.axes.map((axis) => `${axis} and related services`),
    },
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
