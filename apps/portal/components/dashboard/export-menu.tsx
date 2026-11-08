"use client";

import type { ExportFormat } from "@onn/api-client/types";
import { Button } from "@onn/ui/components/ui/button";
import { ChevronDownIcon, DownloadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useExportJob, type ExportLabels } from "@/lib/use-export-job";

export interface ExportMenuProps {
  resource: string;
  params: Record<string, string>;
  formats: { format: ExportFormat; label: string }[];
  labels: ExportLabels & { export: string };
}

/** "Export" menu that runs an export job per format (brief §5.5: PDF, PPTX). */
export function ExportMenu({ resource, params, formats, labels }: ExportMenuProps) {
  const { busy, run, status } = useExportJob(labels);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        ref={button}
        variant="secondary"
        aria-expanded={open}
        loading={busy !== null}
        onClick={() => setOpen(!open)}
      >
        <DownloadIcon aria-hidden />
        {labels.export}
        <ChevronDownIcon aria-hidden />
      </Button>
      {open && (
        <ul className="bg-popover absolute end-0 z-30 mt-1 min-w-48 rounded-md border p-1 shadow-md">
          {formats.map((item) => (
            <li key={item.format}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void run(item.format, resource, params);
                }}
                className="hover:bg-accent min-h-11 w-full rounded-sm px-3 text-start text-sm"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
