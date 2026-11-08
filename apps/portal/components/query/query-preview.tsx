"use client";

import { DataTable, type DataTableColumn } from "@onn/ui/components/data-table";

export interface PreviewRow {
  id: string;
  indicator: string;
  area: string;
  period: string;
  breakdown: string;
  value: number | null;
  /** Formatted with the indicator's unit kind on the server. */
  display: string;
  unit: string;
  status: string;
}

/** Long-format preview of the first rows the query returns (brief §5.7). */
export function QueryPreview({
  caption,
  rows,
  labels,
}: {
  caption: string;
  rows: PreviewRow[];
  labels: Record<
    | "indicator"
    | "area"
    | "period"
    | "breakdown"
    | "value"
    | "unit"
    | "status"
    | "empty"
    | "sortBy",
    string
  >;
}) {
  const text = (
    id: keyof PreviewRow & keyof typeof labels,
    width?: number,
  ): DataTableColumn<PreviewRow> => ({
    id,
    header: labels[id],
    value: (row) => row[id] as string,
    sortable: true,
    width,
  });
  const columns: DataTableColumn<PreviewRow>[] = [
    text("indicator", 220),
    text("area", 140),
    text("period"),
    text("breakdown"),
    {
      id: "value",
      header: labels.value,
      value: (row) => row.value,
      cell: (row) => row.display,
      numeric: true,
      sortable: true,
    },
    text("unit"),
    text("status"),
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowId={(row) => row.id}
      emptyLabel={labels.empty}
      maxHeight={560}
      sortLabel={(header) => labels.sortBy.replace("{column}", header)}
    />
  );
}
