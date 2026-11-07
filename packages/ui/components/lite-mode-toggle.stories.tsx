import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { LiteDemo } from "./small.stories-helpers";

const meta = {
  title: "UI/LiteModeToggle",
  component: LiteDemo,
  args: { label: "Lite mode", description: "Faster on slow connections: no maps or images." },
} satisfies Meta<typeof LiteDemo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("switch", { name: "Lite mode" });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  },
};

export const LongText: Story = {
  args: {
    label: "Lite mode for slow or expensive connections",
    description:
      "Shows tables and simple images instead of interactive maps and charts, and skips photos, to use less data.",
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
