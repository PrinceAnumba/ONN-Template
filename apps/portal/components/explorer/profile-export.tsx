"use client";

import { Button } from "@onn/ui/components/ui/button";
import { DownloadIcon } from "lucide-react";
import { useExportJob, type ExportLabels } from "@/lib/use-export-job";

export interface ProfileExportLabels extends ExportLabels {
  download: string;
}

/** "Download profile (PDF)" for the area profile (brief §5.2). */
export function ProfileExport({ area, labels }: { area: string; labels: ProfileExportLabels }) {
  const { busy, run, status } = useExportJob(labels);
  return (
    <>
      <Button
        variant="secondary"
        loading={busy !== null}
        onClick={() => void run("pdf", "profile", { area })}
      >
        <DownloadIcon aria-hidden />
        {labels.download}
      </Button>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </>
  );
}
