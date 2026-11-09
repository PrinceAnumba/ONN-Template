"use client";

import { ExportTimeoutError, api, pollExport } from "@onn/api-client";
import type { ExportFormat, ExportJob } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

export interface ExportLabels {
  preparing: string;
  ready: string;
  failed: string;
}

/** After the first 60 s, keep polling quietly until 5 minutes have passed in all (§8). */
const BACKGROUND_LIMIT_MS = 4 * 60_000;

/**
 * Starts an export job and polls it every 1.5 s. Past 60 s a toast says it's slow and polling
 * carries on in the background; a failure or a 5-minute timeout shows an error toast with retry.
 */
export function useExportJob(labels: ExportLabels) {
  const locale = useLocale();
  const common = useTranslations("Common");
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat, resource: string, params: Record<string, string>) => {
    setBusy(format);
    try {
      const ctx = { locale };
      const { jobId } = await api.createExport(ctx, { format, resource, params });
      let job: ExportJob;
      try {
        job = await pollExport(ctx, jobId);
      } catch (error) {
        if (!(error instanceof ExportTimeoutError)) throw error;
        showToast(common("exportSlow"));
        job = await pollExport(ctx, jobId, BACKGROUND_LIMIT_MS);
      }
      if (job.status !== "done" || !job.url) throw new Error("Export failed");
      Object.assign(document.createElement("a"), { href: job.url, download: "" }).click();
      showToast(labels.ready);
    } catch {
      showToast(labels.failed, "error", {
        label: common("retry"),
        onClick: () => void run(format, resource, params),
      });
    } finally {
      setBusy(null);
    }
  };

  return { busy, run, status: busy ? labels.preparing : "" };
}
