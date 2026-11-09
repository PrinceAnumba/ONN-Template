import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "@storybook/test";
import { useState } from "react";
import { EntryGrid, type EntryGridRow } from "./entry-grid";

const columns = [
  { key: "2024", label: "2024", editable: true },
  { key: "2025", label: "2025", editable: true },
  { key: "2026", label: "2026", editable: true },
];
const baseRows: EntryGridRow[] = [
  { key: "SEN", label: "Senegal" },
  { key: "SN-01", label: "Dakar" },
  { key: "SN-02", label: "Diourbel" },
  { key: "F", label: "Women", group: "Sex" },
  { key: "M", label: "Men", group: "Sex" },
];
const start: Record<string, string> = {
  "SEN|2024": "70.1",
  "SEN|2025": "74.3",
  "SN-01|2024": "88",
  "SN-01|2025": "90.5",
  "SN-02|2024": "52",
  "SN-02|2025": "55.4",
  "F|2025": "71",
  "M|2025": "77.2",
};

function Grid({
  rows = baseRows,
  readOnly,
  initial = start,
}: {
  rows?: EntryGridRow[];
  readOnly?: boolean;
  initial?: Record<string, string>;
}) {
  const [values, setValues] = useState(initial);
  const prev = (column: string) => String(Number(column) - 1);
  return (
    <EntryGrid
      caption="4G population coverage, %"
      rowHeader="Area"
      columns={columns}
      rows={rows}
      readOnly={readOnly}
      value={(row, column) => values[`${row}|${column}`] ?? ""}
      previous={(row, column) => values[`${row}|${prev(column)}`]}
      issue={(row, column) => {
        const text = values[`${row}|${column}`];
        if (text === undefined || text === "") return undefined;
        const n = Number(text.replace(",", "."));
        if (Number.isNaN(n)) return { level: "error", label: "Not a number" };
        if (n > 100) return { level: "error", label: "Over 100%" };
        const before = Number(values[`${row}|${prev(column)}`]);
        if (before && Math.abs(n - before) / before > 0.3)
          return { level: "warning", label: "Change over 30%" };
        return undefined;
      }}
      onChange={(changes) =>
        setValues((current) => {
          const next = { ...current };
          for (const change of changes) next[`${change.row}|${change.column}`] = change.value;
          return next;
        })
      }
      cellLabel={(row, column) => `${rows.find((item) => item.key === row)?.label}, ${column}`}
    />
  );
}

const meta = {
  title: "UI/EntryGrid",
  component: EntryGrid,
  render: () => <Grid />,
} satisfies Meta<typeof EntryGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

// Args are unused: each story renders its own stateful grid.
const args = {} as Story["args"];

export const Default: Story = {
  args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dakar = canvas.getByRole("textbox", { name: "Dakar, 2026" });
    await userEvent.click(dakar);
    await userEvent.keyboard("150");
    await expect(dakar).toHaveAttribute("aria-invalid", "true");
    await userEvent.keyboard("{ArrowDown}");
    await expect(canvas.getByRole("textbox", { name: "Diourbel, 2026" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(canvas.getByRole("textbox", { name: "Diourbel, 2025" })).toHaveFocus();
    const senegal = canvas.getByRole("textbox", { name: "Senegal, 2026" });
    // A native paste event: Testing Library's fireEvent rebuilds DataTransfer and drops its data.
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", "75\n91\n57\n");
    senegal.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }),
    );
    await waitFor(() => expect(senegal).toHaveValue("75"));
    await expect(canvas.getByRole("textbox", { name: "Diourbel, 2026" })).toHaveValue("57");
  },
};

export const ReadOnly: Story = { args, render: () => <Grid readOnly /> };

export const Empty: Story = { args, render: () => <Grid initial={{}} /> };

export const LongText: Story = {
  args,
  render: () => (
    <Grid
      rows={[
        { key: "SEN", label: "Sénégal (ensemble du territoire national)" },
        { key: "SN-01", label: "Région de Dakar, y compris Pikine et Guédiawaye" },
        { key: "F", label: "Femmes de 15 ans et plus", group: "Sexe et tranche d’âge" },
      ]}
    />
  ),
};

export const Rtl: Story = { args, parameters: { direction: "rtl" } };

export const Mobile: Story = { args, parameters: { viewport: { defaultViewport: "mobile360" } } };
