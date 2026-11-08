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

function SingleDemo() {
  const [value, setValue] = useState<[number]>([2025]);
  return (
    <div className="max-w-md">
      <YearSlider<[number]>
        label="Year"
        min={2015}
        max={2025}
        value={value}
        onValueChange={setValue}
        thumbLabels={["Year"]}
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

/** One thumb, as on the map. */
export const SingleYear: Story = {
  render: () => <SingleDemo />,
  play: async ({ canvasElement }) => {
    const thumb = within(canvasElement).getByRole("slider", { name: "Year" });
    thumb.focus();
    await userEvent.keyboard("{PageDown}");
    await expect(thumb).toHaveAttribute("aria-valuenow", "2020");
  },
};
