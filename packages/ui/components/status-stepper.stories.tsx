import type { Meta, StoryObj } from "@storybook/react";
import { StatusStepper } from "./status-stepper";

const meta = {
  title: "UI/StatusStepper",
  component: StatusStepper,
  args: {
    steps: ["Draft", "Submitted", "Verified", "Approved", "Published"],
    current: 2,
    label: "Submission progress",
    doneLabel: "Done:",
    currentLabel: "Current step:",
  },
} satisfies Meta<typeof StatusStepper>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Returned: Story = { args: { current: 1, returnedLabel: "Returned" } };

export const Published: Story = { args: { current: 4 } };

export const LongText: Story = {
  args: {
    steps: ["Brouillon", "Soumise", "Vérifiée", "Approuvée", "Publiée sur le portail"],
    current: 3,
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
