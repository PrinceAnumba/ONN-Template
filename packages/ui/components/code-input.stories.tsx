import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { CodeInput } from "./code-input";

const digits = (word: string) =>
  Array.from({ length: 6 }, (_, index) => `${word} ${index + 1} / 6`);

const meta = {
  title: "UI/CodeInput",
  component: CodeInput,
  args: { name: "code", label: "Verification code", digitLabels: digits("Digit") },
} satisfies Meta<typeof CodeInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = canvas.getAllByRole("textbox");
    await userEvent.click(boxes[0]!);
    await userEvent.keyboard("12");
    await expect(boxes[2]).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    await expect(boxes[1]).toHaveFocus();
    await userEvent.click(boxes[0]!);
    await userEvent.paste("654321");
    await expect(boxes.map((box) => (box as HTMLInputElement).value).join("")).toBe("654321");
  },
};

export const Loading: Story = { args: { disabled: true } };

export const Empty: Story = {};

export const Error: Story = {
  args: { error: "That code is not valid. Check your app and try again." },
};

export const LongText: Story = {
  args: {
    label: "Code de vérification envoyé par votre application d'authentification",
    digitLabels: digits("Chiffre"),
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
