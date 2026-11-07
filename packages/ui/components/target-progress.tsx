import { cn } from "@onn/ui/lib/utils";
import type { TargetStatus } from "../trend";

export interface TargetProgressProps {
  name: string;
  /** Current value as a share of the bar's full scale, 0–1. */
  valueShare: number;
  /** Target position on the same scale, 0–1. */
  targetShare: number;
  /** e.g. "68 % of 85 % by 2030". */
  caption: string;
  status?: TargetStatus;
  statusLabel?: string;
  className?: string;
}

const PILL: Record<TargetStatus, string> = {
  on_track: "bg-positive text-white",
  // #B26A00 is 4.24:1 on white, so it frames ink text rather than carrying white text.
  at_risk: "border-at-risk text-foreground border-2 bg-white",
  off_track: "bg-negative text-white",
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

export function TargetProgress({
  name,
  valueShare,
  targetShare,
  caption,
  status,
  statusLabel,
  className,
}: TargetProgressProps) {
  return (
    <div className={cn("grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", className)}>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground shrink-0 text-sm">{caption}</span>
        </div>
        <div className="bg-border relative mt-2 h-2 rounded-full" aria-hidden>
          <div
            className="bg-brand absolute inset-y-0 start-0 rounded-full"
            style={{ width: `${clamp(valueShare) * 100}%` }}
          />
          <div
            className="bg-foreground absolute -top-1 h-4 w-0.5"
            style={{ insetInlineStart: `${clamp(targetShare) * 100}%` }}
          />
        </div>
      </div>
      {status && statusLabel && (
        <span
          className={cn(
            "rounded-pill justify-self-start px-3 py-0.5 text-sm font-semibold",
            PILL[status],
          )}
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
}
