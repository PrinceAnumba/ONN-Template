"use client";

import { DataTable, type DataTableColumn } from "@onn/ui/components/data-table";

export interface AreaListRow {
  code: string;
  name: string;
  value: number | null;
  rank: number | null;
}

/** The map's list view: same areas and values as a sortable table (brief §5.4, keyboard access). */
export default function AreaList({
  caption,
  rows,
  format,
  selected,
  onSelect,
  labels,
}: {
  caption: string;
  rows: AreaListRow[];
  format: (value: number | null) => string;
  selected?: string;
  onSelect: (code: string) => void;
  labels: { area: string; value: string; rank: string; empty: string; sortBy: string };
}) {
  const columns: DataTableColumn<AreaListRow>[] = [
    {
      id: "name",
      header: labels.area,
      value: (row) => row.name,
      sortable: true,
      cell: (row) => (
        <button
          type="button"
          aria-pressed={row.code === selected}
          onClick={() => onSelect(row.code)}
          className="aria-pressed:text-primary min-h-11 text-start underline aria-pressed:font-semibold"
        >
          {row.name}
        </button>
      ),
    },
    {
      id: "value",
      header: labels.value,
      value: (row) => row.value,
      numeric: true,
      sortable: true,
      cell: (row) => format(row.value),
    },
    {
      id: "rank",
      header: labels.rank,
      value: (row) => row.rank,
      numeric: true,
      sortable: true,
      cell: (row) => (row.rank === null ? format(null) : String(row.rank)),
    },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowId={(row) => row.code}
      emptyLabel={labels.empty}
      sortLabel={(header) => labels.sortBy.replace("{column}", header)}
      className="h-full"
    />
  );
}
