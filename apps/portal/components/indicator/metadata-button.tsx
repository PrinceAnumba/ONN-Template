"use client";

import type { Indicator } from "@onn/api-client/types";
import type { MetadataDrawerProps } from "@onn/ui/components/metadata-drawer";
import { Button } from "@onn/ui/components/ui/button";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

const MetadataDrawer = dynamic(
  () => import("@onn/ui/components/metadata-drawer").then((mod) => mod.MetadataDrawer),
  { ssr: false },
);

export interface MetadataButtonProps {
  indicator: Indicator;
  display: MetadataDrawerProps["display"];
  labels: MetadataDrawerProps["labels"];
  buttonLabel: string;
}

/** "Full metadata" opens the drawer, whose code loads on first click. */
export function MetadataButton({ indicator, display, labels, buttonLabel }: MetadataButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        {buttonLabel}
      </Button>
      {mounted && (
        <MetadataDrawer
          indicator={indicator}
          display={display}
          labels={labels}
          open={open}
          onOpenChange={setOpen}
          onReportIssue={() => router.push(`/feedback?page=/data/${indicator.code}`)}
        />
      )}
    </>
  );
}
