import type { Meta, StoryObj } from "@storybook/react";
import { InboxIcon } from "lucide-react";
import { EmptyState } from "./empty-state";
import { Button } from "./ui/button";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  args: {
    icon: InboxIcon,
    message: "No submissions match these filters.",
    action: <Button>New import</Button>,
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoAction: Story = { args: { action: undefined } };

export const LongText: Story = {
  args: {
    message:
      "Aucune soumission ne correspond à ces filtres. Modifiez la recherche ou choisissez une autre organisation pour voir plus de résultats.",
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
