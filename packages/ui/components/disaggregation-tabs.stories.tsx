import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { useState } from "react";
import { DisaggregationTabs, type SegmentOption } from "./disaggregation-tabs";

const options: SegmentOption[] = [
  { value: "total", label: "Total" },
  { value: "sex", label: "Sex" },
  { value: "age", label: "Age" },
  { value: "area", label: "Urban/rural" },
  { value: "operator", label: "Operator", disabledReason: "Not available for 2025" },
];

function Demo({ items = options }: { items?: SegmentOption[] }) {
  const [value, setValue] = useState(items[0]?.value ?? "");
  return (
    <DisaggregationTabs label="Breakdown" options={items} value={value} onValueChange={setValue} />
  );
}

const meta = { title: "UI/DisaggregationTabs", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Operator is disabled with a reason; arrow keys skip it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const total = canvas.getByRole("radio", { name: "Total" });
    total.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(canvas.getByRole("radio", { name: "Sex" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.keyboard("{End}");
    await expect(canvas.getByRole("radio", { name: "Urban/rural" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  },
};

export const Empty: Story = { args: { items: [{ value: "total", label: "Total" }] } };

export const LongText: Story = {
  args: {
    items: options.map((option) => ({ ...option, label: `${option.label} breakdown` })),
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

/** Overflows and scrolls sideways at 360 px. */
export const Mobile: Story = {
  args: {
    items: [
      ...options,
      { value: "income", label: "Income quintile" },
      { value: "edu", label: "Education" },
    ],
  },
  parameters: { viewport: { defaultViewport: "mobile360" } },
};
