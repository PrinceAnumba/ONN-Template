"use client";

import { cn } from "@onn/ui/lib/utils";
import { useId } from "react";

export interface LiteModeToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/** Footer switch for Lite mode (brief §9). The app stores the choice in a cookie. */
export function LiteModeToggle({
  label,
  description,
  checked,
  onCheckedChange,
  className,
}: LiteModeToggleProps) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        onClick={() => onCheckedChange(!checked)}
        className="flex min-h-11 shrink-0 items-center"
      >
        <span
          aria-hidden
          className={cn(
            "relative h-6 w-11 rounded-full border-2 border-current transition-colors duration-(--onn-dur-1) motion-reduce:transition-none",
            checked && "bg-current",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-4 rounded-full transition-[inset-inline-start] duration-(--onn-dur-1) motion-reduce:transition-none",
              checked ? "start-[22px] bg-[var(--onn-ink)]" : "start-0.5 bg-current",
            )}
          />
        </span>
      </button>
      <span className="pt-2.5">
        <span id={`${id}-label`} className="block text-sm font-semibold">
          {label}
        </span>
        <span id={`${id}-description`} className="block text-xs opacity-80">
          {description}
        </span>
      </span>
    </div>
  );
}
