import type { Meta, StoryObj } from "@storybook/react";
import { DemoRibbon } from "./demo-ribbon";

const meta = {
  title: "UI/DemoRibbon",
  component: DemoRibbon,
  args: { label: "Demo data" },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof DemoRibbon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = { args: { label: "Données de démo" } };

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
