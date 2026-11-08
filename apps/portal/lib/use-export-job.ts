"use client";

import { ExportTimeoutError, api, pollExport } from "@onn/api-client";
import type { ExportFormat } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { useLocale } from "next-intl";
import { useState } from "react";

export interface ExportLabels {
  preparing: string;
  ready: string;
  failed: string;
  timeout: string;
}

/** Starts an export job, polls it every 1.5 s for up to 60 s, then downloads the file (§3). */
export function useExportJob(labels: ExportLabels) {
  const locale = useLocale();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat, resource: string, params: Record<string, string>) => {
    setBusy(format);
    try {
      const ctx = { locale };
      const { jobId } = await api.createExport(ctx, { format, resource, params });
      const job = await pollExport(ctx, jobId);
      if (job.status !== "done" || !job.url) throw new Error("Export failed");
      Object.assign(document.createElement("a"), { href: job.url, download: "" }).click();
      showToast(labels.ready);
    } catch (error) {
      showToast(error instanceof ExportTimeoutError ? labels.timeout : labels.failed, "error");
    } finally {
      setBusy(null);
    }
  };

  return { busy, run, status: busy ? labels.preparing : "" };
}
