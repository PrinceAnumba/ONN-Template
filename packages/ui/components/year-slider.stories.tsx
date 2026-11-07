import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { useState } from "react";
import { YearSlider } from "./year-slider";

function Demo() {
  const [value, setValue] = useState<[number, number]>([2018, 2025]);
  return (
    <div className="max-w-md">
      <YearSlider
        label="Years"
        min={2015}
        max={2025}
        value={value}
        onValueChange={setValue}
        thumbLabels={["From", "To"]}
      />
    </div>
  );
}

const meta = { title: "UI/YearSlider", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const from = within(canvasElement).getByRole("slider", { name: "From" });
    from.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(from).toHaveAttribute("aria-valuenow", "2017");
    await userEvent.keyboard("{PageUp}");
    await expect(from).toHaveAttribute("aria-valuenow", "2022");
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
