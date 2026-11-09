import { cn } from "@onn/ui/lib/utils";
import type { ComponentProps } from "react";

/** Grey block with a 1.4 s shimmer; static under reduced motion (brief §8). */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("onn-skeleton rounded-md", className)} {...props} />;
}

/** Chart placeholder at `ChartFrame`'s default size: a framed box with 3 faint gridlines (§8). */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("bg-card rounded-lg border p-4", className)}>
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
      <div className="mt-3 flex h-[300px] flex-col justify-between py-4 md:h-[420px]">
        {[0, 1, 2].map((line) => (
          <div key={line} className="bg-border h-px w-full opacity-60" />
        ))}
      </div>
    </div>
  );
}

/** Table placeholder: a header and 8 rows at `DataTable`'s 44 px row height (§8). */
export function TableSkeleton({ rows = 8, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={cn("rounded-lg border", className)}>
      <div className="bg-surface-2 flex h-11 items-center px-3">
        <Skeleton className="h-3 w-1/4" />
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex h-11 items-center gap-6 border-t px-3">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="ms-auto h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/** KPI placeholder matching `KpiCard`'s loading state: value bar at 60 % and a sparkline bar. */
export function KpiSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("bg-card flex min-h-[184px] flex-col rounded-lg border p-5", className)}
    >
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-4 h-9 w-3/5" />
      <Skeleton className="mt-2 h-3 w-1/4" />
      <Skeleton className="mt-auto h-8 w-full" />
    </div>
  );
}
