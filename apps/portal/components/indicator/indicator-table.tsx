"use client";

import type { ObsStatus } from "@onn/api-client/types";
import { DataTable, type DataTableColumn } from "@onn/ui/components/data-table";
import { formatPeriod, formatValue } from "@onn/ui/format";
import type { TableRow } from "@/lib/indicator";

export interface IndicatorTableProps {
  caption: string;
  rows: TableRow[];
  periods: string[];
  rowHeader: string;
  unitKind: string;
  tag: string;
  flags: { status: ObsStatus; text: string }[];
  emptyLabel: string;
  sortLabel: string;
}

/** Rows are areas or categories, columns are periods, latest first (brief §5.3). */
export function IndicatorTable({
  caption,
  rows,
  periods,
  rowHeader,
  unitKind,
  tag,
  flags,
  emptyLabel,
  sortLabel,
}: IndicatorTableProps) {
  const flagged = new Set(flags.map((flag) => flag.status));
  const columns: DataTableColumn<TableRow>[] = [
    { id: "name", header: rowHeader, value: (row) => row.name, sortable: true, width: 200 },
    ...periods.map((period): DataTableColumn<TableRow> => ({
      id: period,
      header: formatPeriod(period, tag),
      numeric: true,
      sortable: true,
      value: (row) => row.cells[period]?.value ?? null,
      cell: (row) => {
        const cell = row.cells[period];
        if (!cell) return formatValue(null, unitKind, tag);
        return (
          <>
            {formatValue(cell.value, unitKind, tag)}
            {flagged.has(cell.status) && (
              <sup className="text-muted-foreground ms-0.5">{cell.status.toLowerCase()}</sup>
            )}
          </>
        );
      },
    })),
  ];

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={rows}
      rowId={(row) => row.id}
      emptyLabel={emptyLabel}
      maxHeight={560}
      sortLabel={(header) => sortLabel.replace("{column}", header)}
      legend={
        flags.length > 0 && (
          <ul className="text-muted-foreground flex flex-wrap gap-x-4 text-sm">
            {flags.map((flag) => (
              <li key={flag.status}>{flag.text}</li>
            ))}
          </ul>
        )
      }
    />
  );
}
