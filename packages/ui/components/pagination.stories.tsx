import type { Meta, StoryObj } from "@storybook/react";
import { PageSizeLinks, Pagination } from "./pagination";

const meta = {
  title: "UI/Pagination",
  component: Pagination,
  args: {
    page: 3,
    pageCount: 9,
    href: (page: number) => `?page=${page}`,
    labels: { nav: "Pages", previous: "Previous", next: "Next", page: "Page {page}" },
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FirstPage: Story = { args: { page: 1 } };

export const LastPage: Story = { args: { page: 9 } };

/** A single page renders nothing. */
export const Empty: Story = { args: { page: 1, pageCount: 1 } };

export const LongText: Story = {
  args: {
    page: 48,
    pageCount: 120,
    labels: {
      nav: "Pages",
      previous: "Page précédente",
      next: "Page suivante",
      page: "Page {page}",
    },
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };

export const PageSizes: Story = {
  render: () => (
    <PageSizeLinks
      sizes={[25, 50, 100]}
      current={50}
      href={(size) => `?size=${size}`}
      label="Rows per page"
    />
  ),
};
