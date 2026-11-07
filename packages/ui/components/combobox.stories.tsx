import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { useState } from "react";
import { Combobox, type ComboboxGroup } from "./combobox";

const groups: ComboboxGroup[] = [
  { options: [{ value: "SEN", label: "Senegal" }] },
  {
    label: "Regions",
    options: ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Diourbel", "Kaolack", "Louga"].map(
      (name, i) => ({ value: `SN-0${i + 1}`, label: name }),
    ),
  },
  {
    label: "Departments",
    options: ["Guédiawaye", "Pikine", "Rufisque", "Mbour"].map((name, i) => ({
      value: `SN-01-0${i + 1}`,
      label: name,
      description: "Dakar",
      indent: 1,
    })),
  },
];

function Controlled(props: Partial<React.ComponentProps<typeof Combobox>>) {
  const [value, setValue] = useState<string | null>("SEN");
  return (
    <div className="max-w-sm">
      <Combobox
        label="Focus area"
        groups={groups}
        value={value}
        onChange={setValue}
        clearLabel="Clear"
        noResultsLabel="No matches"
        {...props}
      />
    </div>
  );
}

const meta = {
  title: "UI/Combobox",
  component: Controlled,
} satisfies Meta<typeof Controlled>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Keyboard: Story = {
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("combobox", { name: "Focus area" });
    await userEvent.click(input);
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{End}");
    await expect(input.getAttribute("aria-activedescendant")).toMatch(/option-11$/);
    await userEvent.keyboard("{Home}{ArrowDown}{Enter}");
    await expect(input).toHaveValue("Dakar");
    await userEvent.click(input);
    await userEvent.keyboard("{Escape}");
    await expect(input).toHaveAttribute("aria-expanded", "false");
  },
};

export const TypeAhead: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("combobox", { name: "Focus area" });
    await userEvent.click(input);
    await userEvent.type(input, "thies");
    await expect(canvas.getAllByRole("option")).toHaveLength(1);
  },
};

export const Empty: Story = {
  args: { groups: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("combobox"));
    await expect(canvas.getByText("No matches")).toBeVisible();
  },
};

export const LongText: Story = {
  args: {
    label: "Indicator or dashboard",
    groups: [
      {
        label: "Connectivity and infrastructure › Coverage of mobile networks",
        options: [
          {
            value: "a",
            label: "Proportion of the population covered by at least a 4G mobile network",
            description: "% of population",
            badge: "sub-national",
          },
        ],
      },
    ],
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile360" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("combobox"));
  },
};
