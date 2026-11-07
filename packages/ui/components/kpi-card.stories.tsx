import type { Meta, StoryObj } from "@storybook/react";
import { KpiCard } from "./kpi-card";

const meta = {
  title: "UI/KpiCard",
  component: KpiCard,
  decorators: [
    (Story) => (
      <div className="max-w-72">
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Internet users",
    value: "67.1%",
    year: "2025",
    source: "National ICT survey",
    change: { text: "4.5%", direction: "up", tone: "good", description: "Up 4.5 % on 2024" },
    sparkline: [21, 26, 31, 35, null, 44, 49, 54, 59, 63, 67.1],
    href: "#",
  },
} satisfies Meta<typeof KpiCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Lower is better, so a fall is shown in green. */
export const Improving: Story = {
  args: {
    label: "2 GB data basket",
    value: "3.1",
    unit: "% of GNI per capita",
    change: { text: "12.4%", direction: "down", tone: "good", description: "Down 12.4 % on 2024" },
  },
};

export const Flat: Story = {
  args: {
    change: { text: "0.2%", direction: "flat", tone: "neutral", description: "Flat on 2024" },
  },
};

export const Provisional: Story = { args: { flag: { symbol: "p", label: "Provisional" } } };

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = {
  args: { value: "—", change: undefined, sparkline: undefined, year: "No data yet" },
};

export const LongText: Story = {
  args: {
    label:
      "Proportion of individuals in rural households who used a mobile phone to access the Internet",
    value: "1.2M",
    unit: "people",
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
