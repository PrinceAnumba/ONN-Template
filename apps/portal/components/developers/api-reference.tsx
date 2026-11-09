"use client";

import { Skeleton } from "@onn/ui/components/skeleton";
import { Button } from "@onn/ui/components/ui/button";
import { BookOpenIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

// Scalar (with the Vue runtime inside it) is about 1.3 MB gzipped, so it loads only when asked
// for: scrolling past it on a slow connection shouldn't cost that much data (§9 target device).
const Scalar = dynamic(() => import("./scalar-view").then((mod) => mod.ScalarView), {
  ssr: false,
  loading: () => <Skeleton className="h-[720px] w-full" />,
});

/** Embedded API reference (brief §5.9), loaded on demand; the OpenAPI link stays the fallback. */
export function ApiReference({
  specUrl,
  labels,
}: {
  specUrl: string;
  labels: { load: string; hint: string };
}) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div className="min-h-[720px] overflow-hidden rounded-lg border">
        <Scalar specUrl={specUrl} />
      </div>
    );
  }
  return (
    <div className="bg-surface-2 flex flex-col items-start gap-3 rounded-lg p-6">
      <p className="text-muted-foreground max-w-prose text-sm">{labels.hint}</p>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <BookOpenIcon aria-hidden />
        {labels.load}
      </Button>
    </div>
  );
}
