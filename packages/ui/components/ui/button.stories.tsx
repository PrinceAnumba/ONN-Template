import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { DownloadIcon } from "lucide-react";
import { Button } from "./button";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Download PDF" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const variants = ["primary", "secondary", "ghost", "danger"] as const;
const sizes = ["sm", "md", "lg"] as const;

export const Default: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      {variants.map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          {sizes.map((size) => (
            <Button key={size} {...args} variant={variant} size={size}>
              <DownloadIcon aria-hidden />
              {`${variant} ${size}`}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole("button");
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
  },
};

export const Disabled: Story = { args: { disabled: true } };

export const LongText: Story = {
  args: { children: "Download the full annual digital development report (PDF, 4.2 MB)" },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = {
  args: { className: "w-full" },
  parameters: { viewport: { defaultViewport: "mobile360" } },
};
