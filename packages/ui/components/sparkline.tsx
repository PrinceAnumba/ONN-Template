import { cn } from "@onn/ui/lib/utils";

const WIDTH = 100;
const HEIGHT = 32;
const PADDING = 2;

/** Points for an SVG polyline, split into runs wherever a value is missing. */
export function sparklineRuns(values: (number | null)[]) {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return [];
  const min = Math.min(...known);
  const span = Math.max(...known) - min || 1;
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
  const runs: string[] = [];
  let current: string[] = [];
  values.forEach((value, i) => {
    if (value === null) {
      if (current.length) runs.push(current.join(" "));
      current = [];
      return;
    }
    const y = HEIGHT - PADDING - ((value - min) / span) * (HEIGHT - PADDING * 2);
    current.push(`${(i * step).toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length) runs.push(current.join(" "));
  return runs;
}

/** Axis-free trend line, 32 px high (brief §6). Decorative: the value sits next to it. */
export function Sparkline({
  values,
  className,
}: {
  values: (number | null)[];
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full overflow-visible", className)}
    >
      {sparklineRuns(values).map((points) => (
        <polyline
          key={points}
          points={points}
          fill="none"
          stroke="var(--onn-primary)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
