import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Chart } from "./chart";
import { frameLabels, source, stackedSpec } from "./stories/fixtures";

const meta = {
  title: "Charts/StackedBar",
  component: Chart,
  args: {
    title: "Smartphone users by age",
    source,
    summary: "Smartphone users grew in every age group between 2021 and 2025.",
    labels: frameLabels,
    spec: stackedSpec,
    toggle: {
      label: "Scale",
      field: "mode",
      options: [
        { value: "absolute", label: "Absolute" },
        { value: "percent", label: "100 %" },
      ],
    },
  },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const percent = canvas.getByRole("radio", { name: "100 %" });
    await userEvent.click(percent);
    await expect(percent).toHaveAttribute("aria-checked", "true");
  },
};

export const LongText: Story = {
  args: {
    title: "Smartphone users in rural and urban households by age group and survey round",
    spec: {
      ...stackedSpec,
      series: stackedSpec.series.map((series) => ({
        ...series,
        name: `Aged ${series.name} years`,
      })),
    },
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
