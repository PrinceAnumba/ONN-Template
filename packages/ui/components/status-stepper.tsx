import { CheckIcon, CornerUpLeftIcon } from "lucide-react";
import { cn } from "../lib/utils";

export interface StatusStepperProps {
  /** Step labels in order, e.g. Draft → Published. */
  steps: string[];
  /** Index of the current step. */
  current: number;
  /** Shown on the current step when the item was sent back (e.g. "Returned"). */
  returnedLabel?: string;
  /** Accessible name of the list, e.g. "Submission progress". */
  label: string;
  /** Screen-reader words for done and current steps. */
  doneLabel: string;
  currentLabel: string;
  className?: string;
}

/** Workflow progress (brief §7 submission header). An ordered list, so it reads in sequence. */
export function StatusStepper({
  steps,
  current,
  returnedLabel,
  label,
  doneLabel,
  currentLabel,
  className,
}: StatusStepperProps) {
  return (
    <ol aria-label={label} className={cn("flex flex-wrap items-center gap-x-2 gap-y-3", className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const isCurrent = index === current;
        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className="flex items-center gap-2"
          >
            {index > 0 && (
              <span
                aria-hidden
                className={cn("h-0.5 w-6 shrink-0", done || isCurrent ? "bg-primary" : "bg-border")}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "rounded-pill flex size-7 shrink-0 items-center justify-center border-2 text-xs font-semibold",
                done && "bg-primary border-primary text-primary-foreground",
                isCurrent && !returnedLabel && "border-primary text-primary",
                isCurrent && returnedLabel && "border-at-risk",
                !done && !isCurrent && "border-border text-muted-foreground",
              )}
            >
              {done ? (
                <CheckIcon className="size-4" />
              ) : isCurrent && returnedLabel ? (
                <CornerUpLeftIcon className="size-4" />
              ) : (
                index + 1
              )}
            </span>
            <span className={cn("text-sm", isCurrent ? "font-semibold" : "text-muted-foreground")}>
              <span className="sr-only">
                {done ? `${doneLabel} ` : isCurrent ? `${currentLabel} ` : ""}
              </span>
              {step}
              {isCurrent && returnedLabel && (
                <span className="rounded-pill border-at-risk text-foreground ms-2 border px-2 py-0.5 text-xs font-semibold">
                  {returnedLabel}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
