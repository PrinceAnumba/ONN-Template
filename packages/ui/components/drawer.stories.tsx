import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { useState } from "react";
import { Drawer } from "./drawer";
import { Button } from "./ui/button";

function Demo({
  body = "Drawer content.",
  title = "Browse indicators",
}: {
  body?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {title}
      </Button>
      <Drawer open={open} onOpenChange={setOpen} title={title} closeLabel="Close">
        <p>{body}</p>
      </Drawer>
    </>
  );
}

const meta = { title: "UI/Drawer", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

const open = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByRole("button"));
};

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("button");
    await userEvent.click(trigger);
    await expect(within(document.body).getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

export const LongText: Story = {
  args: {
    title: "Indicators in Connectivity and infrastructure › Coverage",
    body: "Long content. ".repeat(200),
  },
  play: open,
};

export const Rtl: Story = { parameters: { direction: "rtl" }, play: open };

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile360" } },
  play: open,
};
