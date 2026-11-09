import type { Meta, StoryObj } from "@storybook/react";
import { FallbackBadge } from "./fallback-badge";

const meta = {
  title: "UI/FallbackBadge",
  component: FallbackBadge,
  args: { label: "Not yet translated" },
  render: (args) => (
    <h2 className="text-h3 flex flex-wrap items-center gap-2">
      <span lang="fr">Couverture 4G de la population</span>
      <FallbackBadge {...args} />
    </h2>
  ),
} satisfies Meta<typeof FallbackBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongText: Story = { args: { label: "Pas encore traduit dans cette langue" } };

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
