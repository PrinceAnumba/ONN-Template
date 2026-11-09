import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { useState } from "react";
import { BulkActionBar } from "./bulk-action-bar";
import { Button } from "./ui/button";

function Demo({
  initial = 3,
  countLabel,
}: {
  initial?: number;
  countLabel?: (n: number) => string;
}) {
  const [count, setCount] = useState(initial);
  return (
    <div className="min-h-64">
      <Button variant="secondary" onClick={() => setCount((n) => n + 1)}>
        Select one more
      </Button>
      <BulkActionBar
        count={count}
        countLabel={countLabel ? countLabel(count) : `${count} selected`}
        label="Bulk actions"
        clearLabel="Clear selection"
        onClear={() => setCount(0)}
      >
        <Button variant="secondary">Verify</Button>
        <Button variant="secondary">Return</Button>
      </BulkActionBar>
    </div>
  );
}

const meta = {
  title: "UI/BulkActionBar",
  component: BulkActionBar,
  args: {
    count: 3,
    countLabel: "3 selected",
    label: "Bulk actions",
    clearLabel: "Clear",
    onClear: () => {},
    children: null,
  },
  render: () => <Demo />,
} satisfies Meta<typeof BulkActionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const bar = body.getByRole("region", { name: "Bulk actions" });
    await expect(bar).toHaveTextContent("3 selected");
    await userEvent.click(body.getByRole("button", { name: "Clear selection" }));
    await expect(bar).toHaveAttribute("inert");
  },
};

export const Empty: Story = { render: () => <Demo initial={0} /> };

export const LongText: Story = {
  render: () => (
    <Demo initial={12} countLabel={(n) => `${n} soumissions sélectionnées sur cette page`} />
  ),
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
