"use client";

import { cn } from "@onn/ui/lib/utils";
import { EllipsisVerticalIcon } from "lucide-react";
import * as React from "react";
import { showToast } from "./toast";
import { Button } from "./ui/button";

export interface WidgetTable {
  columns: string[];
  /** Raw values, for the CSV. */
  rows: (string | number | null)[][];
  /** Formatted values, for "View data". */
  display: string[][];
  numeric: boolean[];
}

export interface WidgetShellLabels {
  /** Accessible name of the ⋮ button, e.g. "Actions for Internet users". */
  menu: string;
  viewData: string;
  hideData: string;
  downloadCsv: string;
  openExplorer: string;
  copyLink: string;
  linkCopied: string;
}

export interface WidgetShellProps {
  id: string;
  title: string;
  span: 1 | 2 | 3;
  labels: WidgetShellLabels;
  table?: WidgetTable;
  explorerHref?: string;
  /** Rendered as a plain anchor so this component stays free of the app's router. */
  className?: string;
  children: React.ReactNode;
}

const SPAN = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3" } as const;

const cell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Dashboard widget: title, ⋮ menu (View data, Download CSV, Open in explorer, Copy link) (§5.5). */
export function WidgetShell({
  id,
  title,
  span,
  labels,
  table,
  explorerHref,
  className,
  children,
}: WidgetShellProps) {
  const [open, setOpen] = React.useState(false);
  const [showData, setShowData] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const anchor = `w-${id}`;

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const download = () => {
    if (!table) return;
    const csv = [table.columns, ...table.rows].map((row) => row.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `${anchor}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const copyLink = async () => {
    const url = new URL(window.location.href);
    url.hash = anchor;
    await navigator.clipboard.writeText(url.toString());
    showToast(labels.linkCopied);
  };

  const item =
    "hover:bg-accent flex min-h-11 w-full items-center rounded-sm px-3 text-start text-sm";
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className={cn(
        "bg-card flex min-w-0 scroll-mt-24 flex-col rounded-lg border p-4",
        SPAN[span],
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 id={`${anchor}-title`} className="text-h3 min-w-0">
          {title}
        </h2>
        <div ref={menuRef} className="relative -me-2 -mt-2 shrink-0">
          <Button
            ref={buttonRef}
            variant="ghost"
            size="icon"
            aria-label={labels.menu}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <EllipsisVerticalIcon aria-hidden />
          </Button>
          {open && (
            <ul className="bg-popover absolute end-0 z-30 mt-1 min-w-48 rounded-md border p-1 shadow-md">
              {table && (
                <>
                  <li>
                    <button
                      type="button"
                      className={item}
                      onClick={run(() => setShowData(!showData))}
                    >
                      {showData ? labels.hideData : labels.viewData}
                    </button>
                  </li>
                  <li>
                    <button type="button" className={item} onClick={run(download)}>
                      {labels.downloadCsv}
                    </button>
                  </li>
                </>
              )}
              {explorerHref && (
                <li>
                  <a href={explorerHref} className={item}>
                    {labels.openExplorer}
                  </a>
                </li>
              )}
              <li>
                <button type="button" className={item} onClick={run(() => void copyLink())}>
                  {labels.copyLink}
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {table && showData && (
        <div
          role="region"
          aria-label={title}
          // Scrollable region must be reachable by keyboard.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="mt-3 max-h-80 overflow-auto rounded-md border"
        >
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-surface-2 sticky top-0">
              <tr>
                {table.columns.map((column, i) => (
                  <th
                    key={column}
                    scope="col"
                    className={cn(
                      "p-2 font-semibold",
                      table.numeric[i] ? "text-end" : "text-start",
                    )}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.display.map((row, r) => (
                <tr key={r} className="border-t">
                  {row.map((value, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-2",
                        table.numeric[i] ? "text-end tabular-nums" : "text-start",
                      )}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
