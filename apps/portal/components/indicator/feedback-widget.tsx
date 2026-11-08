"use client";

import { api } from "@onn/api-client";
import { Button } from "@onn/ui/components/ui/button";
import { useLocale } from "next-intl";
import { useId, useState } from "react";

export interface FeedbackLabels {
  useful: string;
  yes: string;
  no: string;
  comment: string;
  send: string;
  thanks: string;
  error: string;
}

/** "Was this useful?" with an optional comment (brief §5.3). */
export function FeedbackWidget({ page, labels }: { page: string; labels: FeedbackLabels }) {
  const locale = useLocale();
  const id = useId();
  const [useful, setUseful] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (state === "sent") {
    return (
      <p role="status" className="font-semibold">
        {labels.thanks}
      </p>
    );
  }

  const send = async () => {
    setState("sending");
    try {
      await api.feedback(
        { locale },
        { useful: useful ?? undefined, message: message || undefined, page },
      );
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <fieldset>
        <legend className="font-semibold">{labels.useful}</legend>
        <div className="mt-2 flex gap-2">
          {[true, false].map((value) => (
            <Button
              key={String(value)}
              type="button"
              variant="secondary"
              aria-pressed={useful === value}
              onClick={() => setUseful(value)}
              className="aria-pressed:border-primary aria-pressed:bg-surface-2"
            >
              {value ? labels.yes : labels.no}
            </Button>
          ))}
        </div>
      </fieldset>
      {useful !== null && (
        <div className="mt-3 flex flex-col gap-2">
          <label htmlFor={id} className="text-sm">
            {labels.comment}
          </label>
          <textarea
            id={id}
            value={message}
            maxLength={2000}
            rows={3}
            onChange={(event) => setMessage(event.target.value)}
            className="bg-background rounded-md border p-2"
          />
          <Button type="submit" loading={state === "sending"} className="self-start">
            {labels.send}
          </Button>
        </div>
      )}
      {state === "error" && (
        <p role="alert" className="text-negative mt-2 text-sm">
          {labels.error}
        </p>
      )}
    </form>
  );
}
