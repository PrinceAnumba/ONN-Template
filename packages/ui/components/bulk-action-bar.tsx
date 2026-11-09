"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export interface BulkActionBarProps {
  /** Number of selected rows; the bar slides up when it's above zero. */
  count: number;
  /** "{count} selected", already filled. */
  countLabel: string;
  /** Accessible name of the bar, e.g. "Bulk actions". */
  label: string;
  clearLabel: string;
  onClear: () => void;
  /** The actions, usually Buttons. */
  children: ReactNode;
  className?: string;
}

/**
 * Bar that slides up from the bottom while rows are selected (brief §7 list pattern). It stays in
 * the page while hidden, inert, so the count change is announced without moving focus.
 */
export function BulkActionBar({
  count,
  countLabel,
  label,
  clearLabel,
  onClear,
  children,
  className,
}: BulkActionBarProps) {
  const open = count > 0;
  return (
    <div
      role="region"
      aria-label={label}
      inert={!open}
      data-open={open || undefined}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4",
        "ease-onn translate-y-full opacity-0 transition duration-(--onn-dur-2) data-open:translate-y-0 data-open:opacity-100",
        className,
      )}
    >
      <div className="bg-foreground pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-lg p-2 ps-4 text-white shadow-lg">
        <p aria-live="polite" className="me-2 text-sm font-semibold">
          {open ? countLabel : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
        <Button variant="ghost" onClick={onClear} className="text-white hover:bg-white/10">
          {clearLabel}
        </Button>
      </div>
    </div>
  );
}
