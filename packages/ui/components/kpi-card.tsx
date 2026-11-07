import { cn } from "@onn/ui/lib/utils";
import type { ElementType, ReactNode } from "react";
import { Skeleton } from "./skeleton";
import { Sparkline } from "./sparkline";

const ARROW = { up: "▲", down: "▼", flat: "▬" } as const;

export interface KpiCardProps {
  label: string;
  /** Already formatted, e.g. "43,7 %". */
  value: string;
  /** Left out when the value carries its unit. */
  unit?: string;
  year: string;
  /** Organisation the figure comes from. */
  source?: string;
  change?: {
    text: string;
    direction: "up" | "down" | "flat";
    tone: "good" | "bad" | "neutral";
    /** Full sentence for screen readers, e.g. "Up 3.2 % on 2024". */
    description: string;
  };
  sparkline?: (number | null)[];
  /** Superscript for an estimate or provisional latest value. */
  flag?: { symbol: string; label: string };
  href?: string;
  /** Lets an app pass its router-aware link. */
  linkComponent?: ElementType;
  loading?: boolean;
  className?: string;
}

const TONE = {
  good: "text-positive",
  bad: "text-negative",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  unit,
  year,
  source,
  change,
  sparkline,
  flag,
  href,
  linkComponent: LinkComponent = "a",
  loading,
  className,
}: KpiCardProps) {
  // relative: keeps the sr-only text inside the card, so a scrolling row can clip it.
  const shell = "bg-card relative flex h-full min-h-[184px] flex-col rounded-lg border p-5";
  if (loading) {
    return (
      <div className={cn(shell, className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-4 h-9 w-3/5" />
        <Skeleton className="mt-2 h-3 w-1/4" />
        <Skeleton className="mt-auto h-8 w-full" />
      </div>
    );
  }

  const body: ReactNode = (
    <>
      <span className="line-clamp-2 text-sm">{label}</span>
      <span className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-kpi">{value}</span>
        {flag && (
          <sup className="text-muted-foreground text-xs" title={flag.label}>
            {flag.symbol}
            <span className="sr-only">{flag.label}</span>
          </sup>
        )}
        {unit && <span className="text-muted-foreground">{unit}</span>}
      </span>
      <span className="mt-1 flex items-center gap-2">
        <span className="text-muted-foreground text-xs">{year}</span>
        {change && (
          <span className={cn("text-xs font-semibold", TONE[change.tone])}>
            <span aria-hidden>
              {ARROW[change.direction]} {change.text}
            </span>
            <span className="sr-only">{change.description}</span>
          </span>
        )}
      </span>
      {source && <span className="text-muted-foreground mt-1 truncate text-xs">{source}</span>}
      {sparkline && sparkline.length > 1 && (
        <Sparkline values={sparkline} className="mt-auto pt-3" />
      )}
    </>
  );

  if (!href) return <div className={cn(shell, className)}>{body}</div>;
  return (
    <LinkComponent
      href={href}
      className={cn(
        shell,
        "transition-[transform,box-shadow] duration-(--onn-dur-2) ease-onn hover:-translate-y-0.5 hover:shadow-sm",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {body}
    </LinkComponent>
  );
}
