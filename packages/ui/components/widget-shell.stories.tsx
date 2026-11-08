import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { Skeleton } from "./skeleton";
import { Toaster } from "./toast";
import { WidgetShell } from "./widget-shell";

const labels = {
  menu: "Actions for Internet users",
  viewData: "View data",
  hideData: "Hide data",
  downloadCsv: "Download CSV",
  openExplorer: "Open in explorer",
  copyLink: "Copy link to widget",
  linkCopied: "Link copied",
};
const table = {
  columns: ["Year", "Senegal"],
  rows: [
    ["2024", 63.7],
    ["2025", 69.8],
  ],
  display: [
    ["2024", "63.7%"],
    ["2025", "69.8%"],
  ],
  numeric: [false, true],
};

const meta = {
  title: "UI/WidgetShell",
  component: WidgetShell,
  args: {
    id: "users",
    title: "Internet users",
    span: 1,
    labels,
    table,
    explorerHref: "/en/data/ACCESS.INTERNET_USERS",
    children: <p className="text-kpi">69.8%</p>,
  },
  decorators: [
    (Story) => (
      <div className="grid max-w-3xl gap-4 md:grid-cols-3">
        <Story />
        <Toaster closeLabel="Close" />
      </div>
    ),
  ],
} satisfies Meta<typeof WidgetShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: labels.menu }));
    await userEvent.click(canvas.getByRole("button", { name: "View data" }));
    await expect(canvas.getByRole("table")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: labels.menu }));
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByRole("button", { name: labels.menu })).toHaveFocus();
  },
};

export const Loading: Story = {
  args: { table: undefined, children: <Skeleton className="h-24 w-full" /> },
};

export const Empty: Story = {
  args: {
    table: undefined,
    children: <p className="text-muted-foreground">No data for this selection.</p>,
  },
};

export const Error: Story = {
  args: {
    table: undefined,
    children: <p role="alert">This widget couldn&apos;t load.</p>,
  },
};

export const LongText: Story = {
  args: {
    span: 2,
    title: "Share of individuals using the Internet in the last three months, by sex and age group",
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
