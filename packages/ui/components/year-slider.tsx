"use client";

import { cn } from "@onn/ui/lib/utils";
import { Slider } from "radix-ui";
import type { KeyboardEvent } from "react";

const BIG_STEP = 5;

export interface YearSliderProps {
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  thumbLabels: [string, string];
  className?: string;
}

/** Dual-thumb year range: arrows step 1 year, PageUp/PageDown step 5 (brief §6). */
export function YearSlider({
  label,
  min,
  max,
  value,
  onValueChange,
  thumbLabels,
  className,
}: YearSliderProps) {
  const span = max - min || 1;
  const position = (year: number) => `${((year - min) / span) * 100}%`;

  // Radix moves 10 steps on PageUp/PageDown; the brief asks for 5.
  const onKeyDown = (index: 0 | 1) => (event: KeyboardEvent) => {
    if (event.key !== "PageUp" && event.key !== "PageDown") return;
    event.preventDefault();
    const delta = event.key === "PageUp" ? BIG_STEP : -BIG_STEP;
    const next: [number, number] = [...value];
    next[index] = Math.min(Math.max(next[index] + delta, min), max);
    if (next[0] <= next[1]) onValueChange(next);
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
        onValueChange={(next) => onValueChange([next[0] ?? min, next[1] ?? max])}
        className="relative flex h-11 w-full touch-none items-center select-none"
      >
        <Slider.Track className="bg-border relative h-1.5 grow rounded-full">
          <Slider.Range className="bg-brand absolute h-full rounded-full" />
        </Slider.Track>
        {([0, 1] as const).map((index) => (
          <Slider.Thumb
            key={index}
            aria-label={thumbLabels[index]}
            onKeyDown={onKeyDown(index)}
            className="border-primary bg-background block size-5 rounded-full border-2 shadow-sm"
          />
        ))}
        {([0, 1] as const).map((index) => (
          <span
            key={`label-${index}`}
            aria-hidden
            className="absolute -top-7 -translate-x-1/2 text-sm font-semibold tabular-nums rtl:translate-x-1/2"
            style={{ insetInlineStart: position(value[index]) }}
          >
            {value[index]}
          </span>
        ))}
      </Slider.Root>
    </div>
  );
}
