"use client";

import { FileUpIcon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "../lib/utils";

export interface FileDropLabels {
  /** Visible instruction, e.g. "Drag a file here or". */
  prompt: string;
  /** The button that opens the file picker. */
  browse: string;
  /** Accepted formats and size, shown under the prompt. */
  hint: string;
  /** Accessible name of the remove button. */
  remove: string;
  /** Accessible name of the upload progress bar. */
  progress: string;
}

/**
 * A drop zone with a real file input behind a button, so it works by keyboard and on touch
 * devices that can't drag. Checks extension and size before handing the file over; the caller
 * shows `error` (from `onReject` or the upload) under it. `progress` (0–1) shows an upload bar.
 */
export function FileDrop({
  accept,
  maxBytes,
  file,
  fileLabel,
  onFile,
  onReject,
  onClear,
  error,
  progress,
  disabled,
  labels,
}: {
  /** Extensions with the dot, e.g. [".csv", ".json"]. */
  accept: string[];
  maxBytes: number;
  file?: File | null;
  /** Name and size of the chosen file, formatted by the caller. */
  fileLabel?: string;
  onFile: (file: File) => void;
  onReject: (reason: "type" | "size", file: File) => void;
  onClear?: () => void;
  error?: string;
  progress?: number;
  disabled?: boolean;
  labels: FileDropLabels;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const id = useId();

  const take = (picked: File | undefined) => {
    if (!picked) return;
    const ext = `.${picked.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!accept.includes(ext)) onReject("type", picked);
    else if (picked.size > maxBytes) onReject("size", picked);
    else onFile(picked);
  };

  return (
    <div>
      <div
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          if (!disabled) take(event.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center",
          over ? "border-primary bg-primary/5" : "border-border",
          error && "border-destructive",
          disabled && "opacity-60",
        )}
      >
        <FileUpIcon aria-hidden className="text-muted-foreground size-8" />
        <p>
          {labels.prompt}{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={() => input.current?.click()}
            aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
            className="text-primary inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            {labels.browse}
          </button>
        </p>
        <p id={`${id}-hint`} className="text-muted-foreground text-sm">
          {labels.hint}
        </p>
        <input
          ref={input}
          type="file"
          accept={accept.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {file && fileLabel && (
        <div className="mt-3 flex items-center gap-3 rounded-md border p-3">
          <FileUpIcon aria-hidden className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">{fileLabel}</span>
          {onClear && !disabled && (
            <button
              type="button"
              onClick={onClear}
              aria-label={labels.remove}
              className="hover:bg-surface-2 inline-flex size-11 items-center justify-center rounded-md"
            >
              <XIcon aria-hidden className="size-4" />
            </button>
          )}
        </div>
      )}
      {progress !== undefined && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={labels.progress}
          className="bg-surface-2 rounded-pill mt-3 h-2 overflow-hidden"
        >
          <div
            className="bg-primary h-full transition-[width] duration-(--onn-dur-1)"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="text-destructive mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
