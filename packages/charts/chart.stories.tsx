import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Chart } from "./chart";
import { frameLabels, lineSpec, source } from "./stories/fixtures";

const meta = {
  title: "Charts/ChartFrame",
  component: Chart,
  args: {
    title: "Internet users",
    subtitle: "Share of people who used the Internet in the last 3 months",
    source,
    summary: "Internet users in Senegal rose from 21 % in 2015 to 68 % in 2025.",
    labels: frameLabels,
    spec: lineSpec,
    shareUrl: "https://example.org/en/data/ACCESS.INTERNET_USERS",
    embedUrl: "https://example.org/embed/chart?i=ACCESS.INTERNET_USERS",
  },
} satisfies Meta<typeof Chart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { name: /rose from 21/ })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "View as table" }));
    await expect(canvas.getByRole("columnheader", { name: "Senegal" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Download" }));
    await expect(canvas.getByRole("button", { name: "CSV data" })).toBeVisible();
  },
};

export const Loading: Story = { args: { status: "loading" } };

export const Empty: Story = { args: { status: "empty" } };

export const Error: Story = {
  args: { status: "error", onRetry: () => undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("Couldn't load this chart.");
    await expect(canvas.getByRole("button", { name: "Try again" })).toBeVisible();
  },
};

export const Refetching: Story = { args: { refetching: true } };

/** Lite mode: the server SVG and table only, no ECharts download. */
export const Lite: Story = { args: { lite: true } };

export const LongText: Story = {
  args: {
    title:
      "Proportion of individuals in rural households who used a mobile phone to access the Internet",
    subtitle:
      "Share of people aged 15 and over in rural households, by survey round, including estimates for years without a survey",
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
