"use client";

import { cn } from "@onn/ui/lib/utils";
import * as React from "react";

export interface SegmentOption {
  value: string;
  label: string;
  /** Explains why it's unavailable; shown as a tooltip and read by screen readers. */
  disabledReason?: string;
}

export interface DisaggregationTabsProps {
  label: string;
  options: SegmentOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/** Segmented control with roving focus; scrolls sideways on narrow screens (brief §6). */
export function DisaggregationTabs({
  label,
  options,
  value,
  onValueChange,
  className,
}: DisaggregationTabsProps) {
  const id = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabledReason);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const position = enabled.findIndex((item) => item.index === index);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const forward = event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight");
    let next = position;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    else next = (position + (forward ? 1 : -1) + enabled.length) % enabled.length;
    const target = enabled[next];
    if (!target) return;
    onValueChange(target.option.value);
    refs.current[target.index]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "bg-surface-2 inline-flex max-w-full gap-1 overflow-x-auto rounded-md p-1",
        className,
      )}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        const disabled = Boolean(option.disabledReason);
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={disabled || undefined}
            aria-describedby={disabled ? `${id}-${index}` : undefined}
            title={option.disabledReason}
            tabIndex={selected ? 0 : -1}
            onClick={() => !disabled && onValueChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "min-h-11 shrink-0 rounded-sm px-4 text-sm font-medium whitespace-nowrap",
              "transition-colors duration-(--onn-dur-1) motion-reduce:transition-none",
              selected ? "bg-background shadow-sm" : "text-muted-foreground",
              disabled && "cursor-not-allowed opacity-45",
            )}
          >
            {option.label}
            {disabled && (
              <span id={`${id}-${index}`} className="sr-only">
                {option.disabledReason}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
