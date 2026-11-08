"use client";

import { cn } from "@onn/ui/lib/utils";
import { Slider } from "radix-ui";
import type { KeyboardEvent } from "react";

const BIG_STEP = 5;

/** One thumb picks a year (map); two pick a range (indicator page). */
export type YearValue = [number] | [number, number];

export interface YearSliderProps<V extends YearValue = [number, number]> {
  label: string;
  min: number;
  max: number;
  value: V;
  onValueChange: (value: V) => void;
  /** Called when a drag or key press ends, for work too costly to run on every step. */
  onValueCommit?: (value: V) => void;
  /** One accessible name per thumb. */
  thumbLabels: string[];
  className?: string;
}

/** Year slider: arrows step 1 year, PageUp/PageDown step 5 (brief §6). */
export function YearSlider<V extends YearValue = [number, number]>({
  label,
  min,
  max,
  value,
  onValueChange,
  onValueCommit,
  thumbLabels,
  className,
}: YearSliderProps<V>) {
  const span = max - min || 1;
  const position = (year: number) => `${((year - min) / span) * 100}%`;
  const clamp = (year: number) => Math.min(Math.max(year, min), max);
  const toValue = (next: number[]) => value.map((_, i) => next[i] ?? value[i]) as V;

  // Radix moves 10 steps on PageUp/PageDown; the brief asks for 5.
  const onKeyDown = (index: number) => (event: KeyboardEvent) => {
    if (event.key !== "PageUp" && event.key !== "PageDown") return;
    event.preventDefault();
    const delta = event.key === "PageUp" ? BIG_STEP : -BIG_STEP;
    const next = [...value];
    next[index] = clamp((next[index] ?? min) + delta);
    if (next.length === 2 && next[0]! > next[1]!) return;
    onValueChange(toValue(next));
    onValueCommit?.(toValue(next));
  };

  return (
    <div className={cn("pt-7", className)}>
      <Slider.Root
        aria-label={label}
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={0}
        value={value}
        onValueChange={(next) => onValueChange(toValue(next))}
        onValueCommit={(next) => onValueCommit?.(toValue(next))}
        className="relative flex h-11 w-full touch-none items-center select-none"
      >
        <Slider.Track className="bg-border relative h-1.5 grow rounded-full">
          <Slider.Range className="bg-brand absolute h-full rounded-full" />
        </Slider.Track>
        {value.map((_, index) => (
          <Slider.Thumb
            key={index}
            aria-label={thumbLabels[index]}
            onKeyDown={onKeyDown(index)}
            className="border-primary bg-background block size-5 rounded-full border-2 shadow-sm"
          />
        ))}
        {value.map((year, index) => (
          <span
            key={`label-${index}`}
            aria-hidden
            className="absolute -top-7 -translate-x-1/2 text-sm font-semibold tabular-nums rtl:translate-x-1/2"
            style={{ insetInlineStart: position(year) }}
          >
            {year}
          </span>
        ))}
      </Slider.Root>
    </div>
  );
}
