"use client";

import { forwardRef, useId, useRef, useState } from "react";
import { BffError } from "@/lib/bff";

export type FieldError = { path: string; message: string };

/** Classes shared by the admin's text inputs and selects (44 px touch target). */
export const FIELD = "border-input bg-background h-11 w-full rounded-md border px-3";

/**
 * The list at the top of a form after a failed save: takes focus (the caller focuses the ref)
 * and links each message to its field (brief §9 error summary).
 */
export const ErrorSummary = forwardRef<
  HTMLDivElement,
  { title: string; items: { href: string; text: string; onClick?: () => void }[] }
>(function ErrorSummary({ title, items }, ref) {
  const id = useId();
  if (items.length === 0) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={id}
      className="border-destructive rounded-lg border-2 p-4"
    >
      <h2 id={id} className="text-h4">
        {title}
      </h2>
      <ul className="mt-2 list-disc ps-5">
        {items.map((item) => (
          <li key={item.href + item.text}>
            <a
              href={item.href}
              className="underline"
              onClick={(event) => {
                if (!item.onClick) return;
                event.preventDefault();
                item.onClick();
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
});

/** The message under one field; its id goes in the field aria-describedby. */
export function FieldMessage({ id, text }: { id: string; text?: string | false }) {
  return text ? (
    <p id={id} className="text-destructive mt-1 text-sm">
      {text}
    </p>
  ) : null;
}

/** Focuses a field by id after React has rendered it (e.g. after selecting another widget). */
export function focusField(id: string) {
  requestAnimationFrame(() => {
    const field = document.getElementById(id);
    field?.focus();
    field?.scrollIntoView({ block: "center" });
  });
}

/** Classes for the admin's multi-line fields. */
export const AREA = "border-input bg-background min-h-24 w-full rounded-md border px-3 py-2";

/**
 * Field errors from a 422, with the ids that link each message to its field and the summary that
 * takes focus. `show` returns false when the error isn't a field error, so the caller can toast.
 */
export function useFormErrors() {
  const id = useId();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const summary = useRef<HTMLDivElement>(null);
  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const errorFor = (path: string) => errors.find((error) => error.path === path);
  return {
    errors,
    summary,
    fieldId,
    errorFor,
    clear: () => setErrors([]),
    describedBy: (path: string, hint?: string) =>
      [hint, errorFor(path) ? `${fieldId(path)}-error` : undefined].filter(Boolean).join(" ") ||
      undefined,
    show: (error: unknown) => {
      const found =
        error instanceof BffError && error.status === 422 && error.errors.length
          ? error.errors
          : null;
      if (!found) return false;
      setErrors(found);
      requestAnimationFrame(() => summary.current?.focus());
      return true;
    },
  };
}

/** Codes the forms have a sentence for (`Admin.forms.error.*`); anything else reads "invalid". */
const ERROR_CODES = [
  "required",
  "duplicate",
  "format",
  "url",
  "path",
  "count",
  "length",
  "unknown",
  "type",
  "size",
  "empty",
  "positive",
  "shape",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number] | "invalid";

export function errorCode(message: string): ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(message) ? (message as ErrorCode) : "invalid";
}
