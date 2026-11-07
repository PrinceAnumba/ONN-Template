import type { LegendClass } from "./classify";

export interface MapLegendProps {
  title: string;
  classes: LegendClass[];
  /** Formats a class edge, e.g. "43,7 %". */
  rangeLabel: (item: LegendClass) => string;
  noData: { label: string; count: number };
  id: string;
}

/** Five classes with ranges and counts, plus the hatched no-data entry (brief §5.4). */
export function MapLegend({ title, classes, rangeLabel, noData, id }: MapLegendProps) {
  const hatch = `${id}-legend-hatch`;
  return (
    <div className="bg-card rounded-lg border p-3 text-sm shadow-sm">
      <p className="mb-2 font-semibold">{title}</p>
      <ul className="flex flex-col gap-1">
        {classes.map((item) => (
          <li key={item.color} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-4 shrink-0 rounded-sm border"
              style={{ background: item.color }}
            />
            <span className="tabular-nums">{rangeLabel(item)}</span>
            <span className="text-muted-foreground ms-auto tabular-nums">{item.count}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <svg aria-hidden className="size-4 shrink-0 rounded-sm border" viewBox="0 0 16 16">
            <defs>
              <pattern
                id={hatch}
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="4" stroke="var(--onn-compare)" strokeWidth="1.5" />
              </pattern>
            </defs>
            <rect width="16" height="16" fill={`url(#${hatch})`} />
          </svg>
          <span>{noData.label}</span>
          <span className="text-muted-foreground ms-auto tabular-nums">{noData.count}</span>
        </li>
      </ul>
    </div>
  );
}
