"use client";

import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { Fragment, useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "../lib/utils";

export interface EntryGridColumn {
  key: string;
  label: string;
  editable: boolean;
}

export interface EntryGridRow {
  key: string;
  label: string;
  /** Rows with the same group sit under one group heading (e.g. a breakdown). */
  group?: string;
}

export interface EntryGridIssue {
  level: "error" | "warning";
  label: string;
}

export interface EntryGridChange {
  row: string;
  column: string;
  value: string;
}

/**
 * Spreadsheet-like entry (brief §7): rows × columns of text inputs. Arrow keys move between cells
 * (left and right once the caret reaches the edge), Enter moves down, and pasting a block copied
 * from Excel fills cells from the focused one. The previous period sits greyed in each cell's
 * corner. The grid stores nothing: the caller owns the values and validation.
 */
export function EntryGrid({
  caption,
  rowHeader,
  columns,
  rows,
  value,
  previous,
  issue,
  onChange,
  cellLabel,
  readOnly,
}: {
  caption: string;
  /** Heading of the first column, e.g. "Area". */
  rowHeader: string;
  columns: EntryGridColumn[];
  rows: EntryGridRow[];
  value: (row: string, column: string) => string;
  /** The previous period's value, formatted, for the corner; undefined hides it. */
  previous: (row: string, column: string) => string | undefined;
  issue: (row: string, column: string) => EntryGridIssue | undefined;
  onChange: (changes: EntryGridChange[]) => void;
  /** Accessible name of a cell, including the previous value, e.g. "Dakar, 2026 (2025: 81)". */
  cellLabel: (row: string, column: string) => string;
  readOnly?: boolean;
}) {
  const id = useId();
  const table = useRef<HTMLTableElement>(null);

  const focusCell = (rowIndex: number, columnIndex: number) => {
    const target = table.current?.querySelector<HTMLInputElement>(
      `input[data-r="${rowIndex}"][data-c="${columnIndex}"]`,
    );
    if (!target) return false;
    target.focus();
    target.select();
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    const all = input.selectionStart === 0 && input.selectionEnd === input.value.length;
    const rtl = getComputedStyle(input).direction === "rtl";
    const left = rtl ? "ArrowRight" : "ArrowLeft";
    const right = rtl ? "ArrowLeft" : "ArrowRight";
    let moved = false;
    if (event.key === "ArrowUp") moved = focusCell(r - 1, c);
    else if (event.key === "ArrowDown" || (event.key === "Enter" && !event.shiftKey))
      moved = focusCell(r + 1, c);
    else if (event.key === "Enter" && event.shiftKey) moved = focusCell(r - 1, c);
    else if (event.key === left && (atStart || all)) moved = focusCell(r, c - 1);
    else if (event.key === right && (atEnd || all)) moved = focusCell(r, c + 1);
    if (moved || event.key === "Enter") event.preventDefault();
  };

  /** A pasted block (tabs between cells, new lines between rows) fills from this cell. */
  const onPaste = (event: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = event.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !/\r?\n./.test(text)) return;
    event.preventDefault();
    const block = text
      .replace(/\r?\n$/, "")
      .split(/\r?\n/)
      .map((line) => line.split("\t"));
    const changes: EntryGridChange[] = [];
    block.forEach((cells, dr) => {
      const row = rows[r + dr];
      if (!row) return;
      cells.forEach((cell, dc) => {
        const column = columns[c + dc];
        if (column?.editable)
          changes.push({ row: row.key, column: column.key, value: cell.trim() });
      });
    });
    if (changes.length) onChange(changes);
  };

  return (
    <div className="relative overflow-x-auto rounded-lg border">
      <table ref={table} className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-2">
            <th
              scope="col"
              className="bg-surface-2 sticky start-0 z-10 p-3 text-start font-semibold"
            >
              {rowHeader}
            </th>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "min-w-32 p-3 text-end font-semibold tabular-nums",
                  !column.editable && "text-muted-foreground",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <Fragment key={row.key}>
              {row.group !== undefined && row.group !== rows[r - 1]?.group && (
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={columns.length + 1}
                    className="bg-background border-t p-3 pt-5 text-start font-semibold"
                  >
                    {row.group}
                  </th>
                </tr>
              )}
              <tr className="border-t">
                <th
                  scope="row"
                  className="bg-background sticky start-0 z-10 max-w-56 p-3 text-start font-normal"
                >
                  {row.label}
                </th>
                {columns.map((column, c) => {
                  const found = issue(row.key, column.key);
                  const corner = previous(row.key, column.key);
                  const issueId = `${id}-${r}-${c}`;
                  const canEdit = column.editable && !readOnly;
                  return (
                    <td key={column.key} className="p-1">
                      <div className="relative">
                        <input
                          data-r={r}
                          data-c={c}
                          value={value(row.key, column.key)}
                          onChange={(event) =>
                            onChange([
                              { row: row.key, column: column.key, value: event.target.value },
                            ])
                          }
                          onKeyDown={(event) => onKeyDown(event, r, c)}
                          onPaste={(event) => onPaste(event, r, c)}
                          onFocus={(event) => event.currentTarget.select()}
                          readOnly={!canEdit}
                          inputMode="decimal"
                          autoComplete="off"
                          aria-label={cellLabel(row.key, column.key)}
                          aria-invalid={found?.level === "error" || undefined}
                          aria-describedby={found ? issueId : undefined}
                          className={cn(
                            "h-12 w-full rounded-md border px-2 pt-3 text-end tabular-nums",
                            canEdit
                              ? "bg-background border-input"
                              : "bg-surface-2 border-transparent",
                            found?.level === "error" && "border-negative border-2",
                            found?.level === "warning" && "border-at-risk border-2",
                          )}
                        />
                        {corner !== undefined && (
                          <span
                            aria-hidden
                            className="text-muted-foreground pointer-events-none absolute start-1.5 top-0.5 text-xs tabular-nums"
                          >
                            {corner}
                          </span>
                        )}
                        {found && (
                          <span className="pointer-events-none absolute end-1.5 top-0.5">
                            {found.level === "error" ? (
                              <CircleAlertIcon aria-hidden className="text-negative size-3.5" />
                            ) : (
                              <TriangleAlertIcon aria-hidden className="text-at-risk size-3.5" />
                            )}
                            <span id={issueId} className="sr-only">
                              {found.label}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
