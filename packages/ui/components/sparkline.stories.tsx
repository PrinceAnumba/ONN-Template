import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";
import { Sparkline } from "./sparkline";

const meta = {
  title: "UI/Sparkline",
  component: Sparkline,
  decorators: [
    (Story) => (
      <div className="w-48">
        <Story />
      </div>
    ),
  ],
  args: { values: [21, 26, 31, 35, 40, 44, 49, 54, 59, 63] },
} satisfies Meta<typeof Sparkline>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A missing year breaks the line rather than bridging it. */
export const WithGap: Story = { args: { values: [21, 26, 31, null, 40, 44, null, 54, 59, 63] } };

export const Falling: Story = {
  args: { values: [12.4, 11, 9.8, 8.1, 7, 6.2, 5.1, 4.4, 3.6, 3.1] },
};

export const SkeletonBlock: Story = { render: () => <Skeleton className="h-8 w-full" /> };
