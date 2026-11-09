"use client";

import { cn } from "@onn/ui/lib/utils";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";
import { EMPTY_VALUE } from "../format";
import { Skeleton } from "./skeleton";

const VIRTUALISE_FROM = 200;
const ROW_HEIGHT = 44;
const LOADING_ROWS = 8;

export interface DataTableColumn<T> {
  id: string;
  header: string;
  /** Raw value, used for sorting. null renders as "—". */
  value: (row: T) => string | number | null;
  /** Custom rendering, e.g. a formatted number with a status flag. */
  cell?: (row: T) => React.ReactNode;
  numeric?: boolean;
  sortable?: boolean;
  width?: number;
  /** Keeps the column from shrinking below this width; the table scrolls instead. */
  minWidth?: number;
}

export interface DataTableProps<T> {
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowId: (row: T) => string;
  emptyLabel: string;
  loading?: boolean;
  /** Shown under the table, e.g. the status flag key. */
  legend?: React.ReactNode;
  maxHeight?: number;
  sortLabel: (header: string) => string;
  className?: string;
  /** Adds a checkbox column (brief §7 list pattern). The table doesn't keep the selection. */
  selection?: {
    selected: ReadonlySet<string>;
    onChange: (selected: Set<string>) => void;
    /** Accessible name for one row's checkbox, e.g. "Select SUB-0001". */
    rowLabel: (row: T) => string;
    /** Accessible name for the header checkbox, e.g. "Select all rows on this page". */
    allLabel: string;
  };
}

/** A header checkbox that shows "some selected" as indeterminate. */
function SelectAll({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex size-11 cursor-pointer items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary size-5"
      />
    </label>
  );
}

/** TanStack Table with sticky header and first column, sorting, resizing and virtualisation. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowId,
  emptyLabel,
  loading,
  legend,
  maxHeight = 560,
  sortLabel,
  className,
  selection,
}: DataTableProps<T>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const columnDefs = React.useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        // undefined, not null, so sortUndefined keeps missing values last in both directions.
        accessorFn: (row) => column.value(row) ?? undefined,
        enableSorting: column.sortable !== false,
        size: column.width ?? 160,
        sortUndefined: "last",
        sortingFn: (a, b, id) => {
          const x = a.getValue<string | number>(id);
          const y = b.getValue<string | number>(id);
          return typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y));
        },
        cell: (info) => {
          const custom = column.cell?.(info.row.original);
          if (custom !== undefined) return custom;
          const value = info.getValue<string | number | undefined>();
          return value === undefined ? EMPTY_VALUE : value;
        },
        meta: { numeric: column.numeric, minWidth: column.minWidth },
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: rowId,
    columnResizeMode: "onChange",
  });

  const tableRows = table.getRowModel().rows;
  const virtual = tableRows.length > VIRTUALISE_FROM;
  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    enabled: virtual,
  });
  const items = virtual ? virtualizer.getVirtualItems() : [];
  const visible = virtual ? items.map((item) => tableRows[item.index]!) : tableRows;
  const padTop = virtual && items.length ? items[0]!.start : 0;
  const padBottom =
    virtual && items.length ? virtualizer.getTotalSize() - items[items.length - 1]!.end : 0;
  const isNumeric = (meta: unknown) => (meta as { numeric?: boolean } | undefined)?.numeric;
  const span = columns.length + (selection ? 1 : 0);
  const pageIds = rows.map(rowId);
  const selectedOnPage = selection ? pageIds.filter((id) => selection.selected.has(id)).length : 0;
  const toggleAll = (checked: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    for (const id of pageIds) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    selection.onChange(next);
  };
  const toggleRow = (id: string, checked: boolean) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (checked) next.add(id);
    else next.delete(id);
    selection.onChange(next);
  };
  // With a checkbox column first, the row header sticks just after it.
  const stickyFirst = selection ? "sticky start-11 z-10" : "sticky start-0 z-10";

  return (
    <div className={className}>
      <div
        ref={scrollRef}
        // Scrollable region must be reachable by keyboard.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label={caption}
        // relative: sr-only text in cells is absolutely positioned and would escape the clip.
        className="relative overflow-auto rounded-lg border"
        style={{ maxHeight }}
      >
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-2 sticky top-0 z-20">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {selection && (
                  <th scope="col" className="bg-surface-2 sticky start-0 z-10 w-11 border-b p-0">
                    <SelectAll
                      checked={pageIds.length > 0 && selectedOnPage === pageIds.length}
                      indeterminate={selectedOnPage > 0 && selectedOnPage < pageIds.length}
                      label={selection.allLabel}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                {group.headers.map((header, index) => {
                  const sorted = header.column.getIsSorted();
                  const numeric = isNumeric(header.column.columnDef.meta);
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      style={{
                        width: header.getSize(),
                        minWidth: (header.column.columnDef.meta as { minWidth?: number })?.minWidth,
                      }}
                      className={cn(
                        "bg-surface-2 relative border-b px-3 py-2 font-semibold whitespace-nowrap",
                        numeric ? "text-end" : "text-start",
                        index === 0 && stickyFirst,
                      )}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={sortLabel(String(header.column.columnDef.header))}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-1 rounded-sm",
                            numeric && "flex-row-reverse",
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUpIcon aria-hidden className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon aria-hidden className="size-3.5" />
                          ) : (
                            <ChevronsUpDownIcon
                              aria-hidden
                              className="text-muted-foreground size-3.5"
                            />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      <div
                        aria-hidden
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="hover:bg-border absolute inset-y-0 end-0 hidden w-1.5 cursor-col-resize lg:block"
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: LOADING_ROWS }, (_, i) => (
                <tr key={i}>
                  {selection && <td className="border-b" />}
                  {columns.map((column) => (
                    <td key={column.id} className="border-b px-3 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && tableRows.length === 0 && (
              <tr>
                <td colSpan={span} className="text-muted-foreground px-3 py-8 text-center">
                  {emptyLabel}
                </td>
              </tr>
            )}
            {padTop > 0 && (
              <tr aria-hidden>
                <td colSpan={span} style={{ height: padTop }} />
              </tr>
            )}
            {!loading &&
              visible.map((row) => (
                <tr
                  key={row.id}
                  aria-selected={selection ? selection.selected.has(row.id) : undefined}
                  className={cn(
                    "hover:bg-surface-2",
                    selection?.selected.has(row.id) && "bg-surface-2",
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  {selection && (
                    <td className="bg-background sticky start-0 z-10 w-11 border-b p-0">
                      <label className="flex size-11 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={selection.rowLabel(row.original)}
                          checked={selection.selected.has(row.id)}
                          onChange={(event) => toggleRow(row.id, event.target.checked)}
                          className="accent-primary size-5"
                        />
                      </label>
                    </td>
                  )}
                  {row.getVisibleCells().map((cell, index) => {
                    const numeric = isNumeric(cell.column.columnDef.meta);
                    // Called directly: flexRender would mount the inline cell function as a
                    // component, so every new `columns` array remounted the cells and lost focus.
                    const render = cell.column.columnDef.cell;
                    const content =
                      typeof render === "function" ? render(cell.getContext()) : render;
                    return index === 0 ? (
                      <th
                        key={cell.id}
                        scope="row"
                        className={cn(
                          "bg-background border-b px-3 py-2 text-start font-normal",
                          stickyFirst,
                        )}
                      >
                        {content}
                      </th>
                    ) : (
                      <td
                        key={cell.id}
                        className={cn("border-b px-3 py-2", numeric && "text-end tabular-nums")}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))}
            {padBottom > 0 && (
              <tr aria-hidden>
                <td colSpan={span} style={{ height: padBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {legend && <div className="text-muted-foreground mt-2 text-xs">{legend}</div>}
    </div>
  );
}
