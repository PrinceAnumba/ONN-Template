import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import { DataTable, type DataTableColumn } from "./data-table";

interface Row {
  code: string;
  name: string;
  y2024: number | null;
  y2025: number | null;
  flag?: string;
}

const regions = [
  "Dakar",
  "Thiès",
  "Saint-Louis",
  "Ziguinchor",
  "Diourbel",
  "Kaolack",
  "Louga",
  "Fatick",
];
const rows: Row[] = regions.map((name, i) => ({
  code: `SN-0${i + 1}`,
  name,
  y2024: i === 3 ? null : 92 - i * 6.2,
  y2025: 95 - i * 5.9,
  flag: i === 1 ? "p" : undefined,
}));

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Region", value: (row) => row.name, width: 180 },
  {
    id: "2025",
    header: "2025",
    value: (row) => row.y2025,
    numeric: true,
    cell: (row) => (
      <>
        {row.y2025?.toFixed(1)}
        {row.flag && <sup className="text-muted-foreground ms-0.5">{row.flag}</sup>}
      </>
    ),
  },
  { id: "2024", header: "2024", value: (row) => row.y2024, numeric: true },
];

const meta = {
  title: "UI/DataTable",
  component: DataTable<Row>,
  args: {
    caption: "4G population coverage by region",
    columns,
    rows,
    rowId: (row: Row) => row.code,
    emptyLabel: "No data for this selection",
    sortLabel: (header: string) => `Sort by ${header}`,
    legend: "p provisional · — no data",
  },
} satisfies Meta<typeof DataTable<Row>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sort = canvas.getByRole("button", { name: "Sort by 2024" });
    const header = canvas.getByRole("columnheader", { name: /2024/ });
    // Numbers sort highest first; missing values stay last in both directions.
    await userEvent.click(sort);
    await expect(header).toHaveAttribute("aria-sort", "descending");
    let cells = canvas.getAllByRole("rowheader");
    await expect(cells[0]).toHaveTextContent("Dakar");
    await expect(cells.at(-1)).toHaveTextContent("Ziguinchor");
    await userEvent.click(sort);
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    cells = canvas.getAllByRole("rowheader");
    await expect(cells[0]).toHaveTextContent("Fatick");
    await expect(cells.at(-1)).toHaveTextContent("Ziguinchor");
  },
};

/** 500 rows: only the visible ones are in the DOM. */
export const Virtualised: Story = {
  args: {
    rows: Array.from({ length: 500 }, (_, i) => ({
      code: `R${i}`,
      name: `Commune ${i + 1}`,
      y2024: (i * 7) % 100,
      y2025: (i * 11) % 100,
    })),
  },
  play: async ({ canvasElement }) => {
    const rendered = within(canvasElement).getAllByRole("rowheader").length;
    await expect(rendered).toBeLessThan(100);
  },
};

export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { rows: [] } };

export const LongText: Story = {
  args: {
    rows: rows.map((row) => ({ ...row, name: `${row.name} region, including its departments` })),
  },
};

export const Rtl: Story = { parameters: { direction: "rtl" } };

export const Mobile: Story = { parameters: { viewport: { defaultViewport: "mobile360" } } };
