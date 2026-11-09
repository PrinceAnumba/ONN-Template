import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { showToast, Toaster } from "./toast";
import { Button } from "./ui/button";

function Demo({ message = "Link copied.", variant = "info" as "info" | "error", retry = false }) {
  const action = retry ? { label: "Try again", onClick: () => showToast("Retrying…") } : undefined;
  return (
    <>
      <Button onClick={() => showToast(message, variant, action)}>{`Show ${variant}`}</Button>
      <Toaster closeLabel="Close" />
    </>
  );
}

const meta = { title: "UI/Toast", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Status toasts clear after 4 s; at most three show at once. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button", { name: "Show info" });
    for (let i = 0; i < 4; i++) await userEvent.click(button);
    await expect(within(document.body).getAllByRole("status")).toHaveLength(3);
  },
};

/** Errors use role="alert" and stay until closed. */
export const Error: Story = {
  args: { message: "The export failed. Try again.", variant: "error" },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Show error" }));
    const body = within(document.body);
    const alert = body.getByRole("alert");
    await userEvent.click(within(alert).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(body.queryByRole("alert")).toBeNull());
  },
};

/** Export failures offer a retry, which closes the toast and runs the action. */
export const WithRetry: Story = {
  args: { message: "The export failed.", variant: "error", retry: true },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Show error" }));
    const body = within(document.body);
    await userEvent.click(
      within(body.getByRole("alert")).getByRole("button", { name: "Try again" }),
    );
    await waitFor(() => expect(body.queryByRole("alert")).toBeNull());
    await expect(body.getByRole("status")).toHaveTextContent("Retrying…");
  },
};

export const LongText: Story = {
  args: {
    message: "The export is taking longer than usual — we'll keep trying in the background.",
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Show/ }));
  },
};

export const Rtl: Story = {
  parameters: { direction: "rtl" },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Show info" }));
  },
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: "mobile360" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Show/ }));
  },
};
