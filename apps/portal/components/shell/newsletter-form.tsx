"use client";

import { api } from "@onn/api-client";
import { Button } from "@onn/ui/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";

export function NewsletterForm() {
  const t = useTranslations("Footer");
  const locale = useLocale();
  const id = useId();
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    setStatus("sending");
    try {
      await api.subscribe({ locale }, { email, locale });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <p role="status" className="mt-2 text-sm">
        {t("subscribed")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2">
      <label htmlFor={`${id}-email`} className="text-sm">
        {t("email")}
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          aria-invalid={status === "error"}
          aria-describedby={status === "error" ? `${id}-error` : undefined}
          className="text-foreground h-11 min-w-0 flex-1 rounded-md bg-white px-3"
        />
        <Button type="submit" variant="secondary" disabled={status === "sending"} className="h-11">
          <span className="text-foreground">{t("subscribe")}</span>
        </Button>
      </div>
      {status === "error" && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm">
          {t("subscribeError")}
        </p>
      )}
    </form>
  );
}
