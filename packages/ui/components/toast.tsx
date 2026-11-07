"use client";

import { cn } from "@onn/ui/lib/utils";
import { XIcon } from "lucide-react";
import * as React from "react";

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 4_000;

interface ToastItem {
  id: number;
  message: string;
  variant: "info" | "error";
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function publish(next: ToastItem[]) {
  items = next;
  listeners.forEach((listener) => listener());
}

function dismiss(id: number) {
  publish(items.filter((item) => item.id !== id));
}

/** Errors stay until closed; everything else clears after 4 s. */
export function showToast(message: string, variant: ToastItem["variant"] = "info") {
  const id = nextId++;
  publish([...items, { id, message, variant }].slice(-MAX_VISIBLE));
  if (variant !== "error") setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY: ToastItem[] = [];

export function Toaster({ closeLabel }: { closeLabel: string }) {
  const toasts = React.useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.variant === "error" ? "alert" : "status"}
          className={cn(
            "bg-foreground pointer-events-auto flex max-w-md items-center gap-2 rounded-md py-2 ps-4 pe-2 text-sm text-white shadow-md",
            item.variant === "error" && "bg-destructive",
          )}
        >
          <span>{item.message}</span>
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => dismiss(item.id)}
            className="flex size-11 shrink-0 items-center justify-center rounded-md"
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
