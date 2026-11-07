import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { useState } from "react";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./ui/button";

function Demo({
  title = "Dakar",
  body = "93.5 % · 2025 · 1st of 14 regions",
}: {
  title?: string;
  body?: string;
}) {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState(0);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {title}
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        closeLabel="Close"
        handleLabel="Resize panel"
        snap={snap}
        onSnapChange={setSnap}
      >
        <p>{body}</p>
        <p className="text-muted-foreground text-sm">{`Snap point ${snap + 1} of 3`}</p>
      </BottomSheet>
    </>
  );
}

const meta = {
  title: "UI/BottomSheet",
  component: Demo,
  parameters: { viewport: { defaultViewport: "mobile360" } },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
};

/** Peek at 96 px, then 50 % and 92 %. The handle cycles snap points from the keyboard. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button");
    await userEvent.click(trigger);
    const body = within(document.body);
    const handle = body.getByRole("button", { name: "Resize panel" });
    handle.focus();
    await userEvent.keyboard("{ArrowUp}");
    await expect(body.getByText("Snap point 2 of 3")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const LongText: Story = {
  args: { title: "Médina Yoro Foulah department, Kolda region", body: "Detail. ".repeat(120) },
  play: open,
};

export const Rtl: Story = { parameters: { direction: "rtl" }, play: open };

export const Mobile: Story = { play: open };
