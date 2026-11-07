import type { Meta, StoryObj } from "@storybook/react";
import { TargetProgress } from "./target-progress";

const meta = {
  title: "UI/TargetProgress",
  component: TargetProgress,
  args: {
    name: "4G population coverage",
    valueShare: 0.85,
    targetShare: 0.89,
    caption: "93.5 % of 98 % by 2030",
    status: "on_track",
    statusLabel: "On track",
  },
} satisfies Meta<typeof TargetProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllStatuses: Story = {
  render: (args) => (
    <div className="flex flex-col gap-6">
      <TargetProgress {...args} />
      <TargetProgress
        {...args}
        name="Internet users"
        valueShare={0.62}
        caption="68 % of 85 % by 2030"
        status="at_risk"
        statusLabel="At risk"
      />
      <TargetProgress
        {...args}
        name="Basic ICT skills"
        valueShare={0.34}
        caption="37 % of 60 % by 2030"
        status="off_track"
        statusLabel="Off track"
      />
    </div>
  ),
};

export const Empty: Story = {
  args: {
    valueShare: 0,
    caption: "No data yet · target 98 % by 2030",
    status: undefined,
    statusLabel: undefined,
  },
};

export const LongText: Story = {
  args: {
    name: "Share of priority public services fully available online, including payment",
    caption: "63 % of 90 % by 2030",
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
