"use client";

import { ExportTimeoutError, api, pollExport } from "@onn/api-client";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { DownloadIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { useState } from "react";

export interface ProfileExportLabels {
  download: string;
  preparing: string;
  ready: string;
  failed: string;
  timeout: string;
}

/** Starts a PDF export job for the profile, polls it, then downloads the file (brief §3). */
export function ProfileExport({ area, labels }: { area: string; labels: ProfileExportLabels }) {
  const locale = useLocale();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const ctx = { locale };
      const { jobId } = await api.createExport(ctx, {
        format: "pdf",
        resource: "profile",
        params: { area },
      });
      const job = await pollExport(ctx, jobId);
      if (job.status !== "done" || !job.url) throw new Error("Export failed");
      Object.assign(document.createElement("a"), { href: job.url, download: "" }).click();
      showToast(labels.ready);
    } catch (error) {
      showToast(error instanceof ExportTimeoutError ? labels.timeout : labels.failed, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" loading={busy} onClick={() => void run()}>
        <DownloadIcon aria-hidden />
        {labels.download}
      </Button>
      <p aria-live="polite" className="sr-only">
        {busy ? labels.preparing : ""}
      </p>
    </>
  );
}
