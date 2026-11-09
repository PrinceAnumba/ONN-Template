import type { Meta, StoryObj } from "@storybook/react";
import { StatusPill, type StatusTone } from "./status-pill";

const TONES: [StatusTone, string][] = [
  ["neutral", "Draft"],
  ["info", "Submitted"],
  ["positive", "Published"],
  ["warning", "Due soon"],
  ["negative", "Overdue"],
];

const meta = {
  title: "UI/StatusPill",
  component: StatusPill,
  args: { label: "Submitted", tone: "info" },
} satisfies Meta<typeof StatusPill>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {TONES.map(([tone, label]) => (
        <StatusPill key={tone} tone={tone} label={label} />
      ))}
    </div>
  ),
};

export const LongText: Story = {
  args: { label: "Renvoyée au contributeur pour correction", tone: "warning" },
  render: (args) => (
    <div className="w-40">
      <StatusPill {...args} />
    </div>
  ),
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
