"use client";

import type { ChannelTest as TestResult } from "@onn/api-client/types";
import { Button } from "@onn/ui/components/ui/button";
import { CircleAlertIcon, CircleCheckIcon, LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { errorCode, FIELD, FieldMessage } from "@/components/forms/form-errors";
import { BffError, bff } from "@/lib/bff";
import { formatDate, formatTime } from "@/lib/format";

/**
 * SMTP or SMS test (brief §7): sends one message through the configured gateway and shows what
 * came back. The result stays on screen (and on the server as "last test"), not in a toast.
 */
export function ChannelTest({
  channel,
  facts,
  last,
}: {
  channel: "smtp" | "sms";
  /** The gateway's settings, read-only: they belong to the deployment. */
  facts: { label: string; value: string }[];
  last?: TestResult;
}) {
  const t = useTranslations("Admin.settings");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const id = useId();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | undefined>(last);
  const [error, setError] = useState<string>();
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      setResult(
        await bff<TestResult>(`/settings/test/${channel}`, { method: "POST", body: { to } }),
      );
    } catch (caught) {
      const field = caught instanceof BffError ? caught.errors[0] : undefined;
      setError(forms(field ? `error.${errorCode(field.message)}` : "saveFailed"));
      document.getElementById(`${id}-to`)?.focus();
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border p-4">
      <h3 id={`${id}-title`} className="text-h4">
        {t(`${channel}.title`)}
      </h3>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="break-all">{fact.value}</dd>
          </div>
        ))}
      </dl>
      <form onSubmit={send} noValidate className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 grow">
          <label htmlFor={`${id}-to`} className="mb-1 block font-semibold">
            {t(`${channel}.to`)}
          </label>
          <input
            id={`${id}-to`}
            className={FIELD}
            type={channel === "smtp" ? "email" : "tel"}
            autoComplete="off"
            value={to}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
          {t(`${channel}.send`)}
        </Button>
      </form>
      <FieldMessage id={`${id}-error`} text={error} />
      <p role="status" className="mt-3 flex items-start gap-2 text-sm">
        {result &&
          (result.ok ? (
            <>
              <CircleCheckIcon
                aria-hidden="true"
                className="text-positive mt-0.5 size-4 shrink-0"
              />
              {t("testOk", {
                date: formatDate(result.date, locale, "medium"),
                time: formatTime(result.date, locale),
              })}
            </>
          ) : (
            <>
              <CircleAlertIcon
                aria-hidden="true"
                className="text-destructive mt-0.5 size-4 shrink-0"
              />
              <span>
                <span className="font-semibold">
                  {t("testFailed", {
                    date: formatDate(result.date, locale, "medium"),
                    time: formatTime(result.date, locale),
                  })}
                </span>{" "}
                {result.detail && <span lang="en">{result.detail}</span>}
              </span>
            </>
          ))}
        {!result && t("neverTested")}
      </p>
    </section>
  );
}
