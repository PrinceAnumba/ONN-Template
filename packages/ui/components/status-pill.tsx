import { cn } from "../lib/utils";

export type StatusTone = "neutral" | "info" | "positive" | "warning" | "negative";

const TONES: Record<StatusTone, { dot: string; border: string }> = {
  neutral: { dot: "bg-muted-foreground", border: "border-border" },
  info: { dot: "bg-brand-secondary", border: "border-brand-secondary" },
  positive: { dot: "bg-positive", border: "border-positive" },
  warning: { dot: "bg-at-risk", border: "border-at-risk" },
  negative: { dot: "bg-negative", border: "border-negative" },
};

/**
 * Status label for workflow states, deadlines and runs. Text stays in ink so it keeps 4.5:1 on
 * any tone; the dot and border carry the colour (3:1 for UI), and the word carries the meaning.
 */
export function StatusPill({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  const colours = TONES[tone];
  return (
    <span
      className={cn(
        "rounded-pill bg-background inline-flex max-w-full items-center gap-1.5 border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        colours.border,
        className,
      )}
    >
      <span aria-hidden className={cn("rounded-pill size-2 shrink-0", colours.dot)} />
      <span className="truncate">{label}</span>
    </span>
  );
}
