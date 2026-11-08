"use client";

import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { CopyIcon } from "lucide-react";

/** Citation text with a copy button (brief §5.9). */
export function Citation({
  text,
  labels,
}: {
  text: string;
  labels: { copy: string; copied: string; failed: string };
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(labels.copied);
    } catch {
      showToast(labels.failed, "error");
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="bg-surface-2 rounded-md p-4 font-mono text-sm break-words select-all">{text}</p>
      <Button type="button" variant="secondary" className="self-start" onClick={copy}>
        <CopyIcon aria-hidden />
        {labels.copy}
      </Button>
    </div>
  );
}
