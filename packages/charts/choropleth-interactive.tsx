"use client";

import { cn } from "@onn/ui/lib/utils";
import * as React from "react";
import type { MapShapes } from "./map-shapes";

export interface ChoroplethInteractiveProps {
  shapes: MapShapes;
  /** Fill per area code; null draws the no-data hatch. */
  fills: Record<string, string | null>;
  /** Accessible name for the map as a whole. */
  title: string;
  /** Tooltip text per area, e.g. "Dakar: 93.5 %". */
  tooltips: Record<string, string>;
  selected?: string;
  onSelect?: (code: string) => void;
  showLabels?: boolean;
  /** Unique per page, for the hatch pattern id. */
  id: string;
  className?: string;
}

/** Smallest projected area that still gets a name when labels are on. */
const LABEL_MIN_AREA = 600;

/**
 * The interactive SVG map (brief §5.4, and the user's decision to keep MapLibre optional). It
 * draws the server-projected shapes: hover outlines 2px in ink with a tooltip, click selects with a
 * 3px primary outline. Keyboard users get the same data through the page's list view.
 */
export function ChoroplethInteractive({
  shapes,
  fills,
  title,
  tooltips,
  selected,
  onSelect,
  showLabels,
  id,
  className,
}: ChoroplethInteractiveProps) {
  const box = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{ code: string; x: number; y: number } | null>(null);
  const hatch = `${id}-hatch`;
  const byCode = React.useMemo(
    () => new Map(shapes.shapes.map((shape) => [shape.code, shape])),
    [shapes],
  );
  const hovered = hover ? byCode.get(hover.code) : undefined;
  const chosen = selected ? byCode.get(selected) : undefined;

  const onMove = (event: React.PointerEvent<SVGPathElement>, code: string) => {
    if (event.pointerType !== "mouse" || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    setHover({ code, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  return (
    <div ref={box} className={cn("relative h-full w-full", className)}>
      <svg
        role="img"
        aria-label={title}
        viewBox={`0 0 ${shapes.width} ${shapes.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
      >
        <defs>
          <pattern
            id={hatch}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="var(--onn-surface)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--onn-compare)" strokeWidth="2" />
          </pattern>
        </defs>
        <g onPointerLeave={() => setHover(null)}>
          {shapes.shapes.map((shape) => (
            <path
              key={shape.code}
              d={shape.d}
              fill={fills[shape.code] ?? `url(#${hatch})`}
              stroke="var(--onn-compare)"
              strokeWidth={0.75}
              className={onSelect ? "cursor-pointer" : undefined}
              onPointerMove={(event) => onMove(event, shape.code)}
              onClick={() => onSelect?.(shape.code)}
            />
          ))}
        </g>
        {/* Outlines drawn on top so neighbours never cover them. */}
        {hovered && hovered.code !== selected && (
          <path
            d={hovered.d}
            fill="none"
            stroke="var(--onn-ink)"
            strokeWidth={2}
            pointerEvents="none"
          />
        )}
        {chosen && (
          // A light halo keeps the outline visible on the darkest class, which shares its colour.
          <path
            d={chosen.d}
            fill="none"
            stroke="var(--onn-surface)"
            strokeWidth={6}
            pointerEvents="none"
          />
        )}
        {chosen && (
          <path
            d={chosen.d}
            fill="none"
            stroke="var(--onn-primary-ink)"
            strokeWidth={3}
            pointerEvents="none"
          />
        )}
        {showLabels && (
          <g aria-hidden pointerEvents="none" className="text-xs font-semibold">
            {shapes.shapes
              .filter((shape) => shape.area >= LABEL_MIN_AREA)
              .map((shape) => (
                <text
                  key={shape.code}
                  x={shape.cx}
                  y={shape.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--onn-ink)"
                  stroke="var(--onn-surface)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {shape.name}
                </text>
              ))}
          </g>
        )}
      </svg>
      {hover && tooltips[hover.code] && (
        <div
          aria-hidden
          className="bg-foreground pointer-events-none absolute z-10 rounded-md px-2 py-1 text-sm whitespace-nowrap text-white shadow-md"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {tooltips[hover.code]}
        </div>
      )}
    </div>
  );
}
