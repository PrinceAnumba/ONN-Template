"use client";

import { api, type DataQuery } from "@onn/api-client";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { DownloadIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";

export interface DataDownloadMenuProps {
  query: DataQuery;
  formats: { format: string; label: string }[];
  label: string;
  failed: string;
  fileName: string;
  variant?: "ghost" | "secondary";
}

const EXTENSION: Record<string, string> = { "sdmx-csv": "csv" };
const JSON_PAGE_SIZE = 500;

/** Downloads `/data` in the chosen format, with an error toast when the server refuses. */
export function DataDownloadMenu({
  query,
  formats,
  label,
  failed,
  fileName,
  variant = "ghost",
}: DataDownloadMenuProps) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  const save = async (format: string) => {
    setOpen(false);
    setBusy(true);
    try {
      const response = await api.dataDownload(
        { locale },
        { ...query, format, pageSize: format === "json" ? JSON_PAGE_SIZE : undefined },
      );
      const url = URL.createObjectURL(await response.blob());
      const name = `${fileName}.${EXTENSION[format] ?? format}`;
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
      URL.revokeObjectURL(url);
    } catch {
      showToast(failed, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <Button
        ref={button}
        variant={variant}
        aria-expanded={open}
        loading={busy}
        onClick={() => setOpen(!open)}
      >
        <DownloadIcon aria-hidden />
        {label}
      </Button>
      {open && (
        <ul className="bg-popover absolute end-0 z-30 mt-1 min-w-44 rounded-md border p-1 shadow-md">
          {formats.map((item) => (
            <li key={item.format}>
              <button
                type="button"
                onClick={() => void save(item.format)}
                className="hover:bg-accent min-h-11 w-full rounded-sm px-3 text-start text-sm"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
