"use client";

import { AlertCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";

export type FieldErrors = Partial<Record<string, string>>;

/** Shown above a form after a failed submit; takes focus and links to each field (§9). */
export function ErrorSummary({
  title,
  errors,
  idPrefix,
  order,
}: {
  title: string;
  errors: FieldErrors;
  idPrefix: string;
  /** Field names in form order, so the list reads top to bottom. */
  order: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = order.flatMap((name) => (errors[name] ? [[name, errors[name]] as const] : []));
  useEffect(() => {
    if (entries.length) ref.current?.focus();
  }, [errors]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!entries.length) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${idPrefix}-summary`}
      className="border-negative rounded-md border-2 bg-white p-4"
    >
      <h2 id={`${idPrefix}-summary`} className="text-h4 flex items-center gap-2">
        <AlertCircleIcon aria-hidden className="text-negative size-5" />
        {title}
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {entries.map(([name, message]) => (
          <li key={name}>
            <a href={`#${idPrefix}-${name}`} className="text-negative font-semibold underline">
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-negative mt-1 flex items-center gap-1 text-sm font-semibold">
      <AlertCircleIcon aria-hidden className="size-4 shrink-0" />
      {message}
    </p>
  );
}

/** aria-describedby for a field: its hint and/or its error, whichever exist. */
export const describedBy = (...ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(" ") || undefined;
