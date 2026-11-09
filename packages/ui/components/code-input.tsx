"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "../lib/utils";

export interface CodeInputProps {
  /** Every box submits under this name; join `formData.getAll(name)` on the server. */
  name: string;
  /** Group label, e.g. "Verification code". */
  label: string;
  /** One accessible name per box, e.g. "Digit 1 of 6". Its length sets the number of boxes. */
  digitLabels: string[];
  /** Inline error, linked to every box. */
  error?: string;
  errorId?: string;
  disabled?: boolean;
  className?: string;
}

const onlyDigits = (text: string) => text.replace(/\D/g, "");

/**
 * One-time code entry (brief §7 sign-in): one box per digit with auto-advance, Backspace back,
 * arrow keys and paste of the whole code. Without JavaScript the boxes are plain inputs.
 */
export function CodeInput({
  name,
  label,
  digitLabels,
  error,
  errorId = `${name}-error`,
  disabled,
  className,
}: CodeInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(index, digitLabels.length - 1))];
    box?.focus();
    box?.select();
  };

  const fill = (start: number, digits: string) => {
    [...digits].slice(0, digitLabels.length - start).forEach((digit, offset) => {
      const box = boxes.current[start + offset];
      if (box) box.value = digit;
    });
    focus(start + digits.length);
  };

  const onInput = (index: number, box: HTMLInputElement) => {
    const digits = onlyDigits(box.value);
    box.value = digits.slice(-1);
    // A phone's one-time-code autofill can put the whole code in the first box.
    if (digits.length > 1) fill(index, digits);
    else if (digits) focus(index + 1);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const box = event.currentTarget;
    if (event.key === "Backspace" && !box.value && index > 0) {
      event.preventDefault();
      const previous = boxes.current[index - 1];
      if (previous) previous.value = "";
      focus(index - 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const forward = (event.key === "ArrowRight") !== (getComputedStyle(box).direction === "rtl");
      focus(index + (forward ? 1 : -1));
    }
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const digits = onlyDigits(event.clipboardData.getData("text"));
    if (!digits) return;
    event.preventDefault();
    fill(index, digits);
  };

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      {/* Digits read left to right in every script. */}
      <div dir="ltr" className="flex gap-2">
        {digitLabels.map((digitLabel, index) => (
          <input
            key={index}
            ref={(element) => {
              boxes.current[index] = element;
            }}
            name={name}
            aria-label={digitLabel}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={digitLabels.length}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            required
            disabled={disabled}
            onInput={(event) => onInput(index, event.currentTarget)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => onPaste(index, event)}
            onFocus={(event) => event.currentTarget.select()}
            className={cn(
              "border-input bg-background text-h3 size-12 rounded-md border text-center tabular-nums",
              error && "border-destructive",
            )}
          />
        ))}
      </div>
      {error && (
        <p id={errorId} className="text-destructive mt-2 text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
