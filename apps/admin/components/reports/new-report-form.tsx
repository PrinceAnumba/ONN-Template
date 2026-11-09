"use client";

import type { ReportAdmin, ReportTemplate } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ErrorSummary, FIELD, FieldMessage, type FieldError } from "@/components/forms/form-errors";
import { bff, BffError } from "@/lib/bff";

const TEMPLATES: ReportTemplate[] = ["quarterly", "annual"];

/** The period just ended, as each template writes it. */
function lastPeriod(template: ReportTemplate, now = new Date()) {
  const year = now.getFullYear();
  if (template === "annual") return String(year - 1);
  const quarter = Math.floor(now.getMonth() / 3);
  return quarter === 0 ? `${year - 1}-Q4` : `${year}-Q${quarter}`;
}

/** Creates a report from a template (brief §7), then opens the builder. */
export function NewReportForm() {
  const t = useTranslations("Admin.reports");
  const router = useRouter();
  const id = useId();
  const [template, setTemplate] = useState<ReportTemplate>("quarterly");
  const [period, setPeriod] = useState(() => lastPeriod("quarterly"));
  const [title, setTitle] = useState(() =>
    t("defaultTitle.quarterly", { period: lastPeriod("quarterly") }),
  );
  const [titleEdited, setTitleEdited] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const fieldId = (path: string) => `${id}-${path}`;
  const errorFor = (path: string) => errors.find((error) => error.path === path);
  const message = (error: FieldError) =>
    error.path === "period" && error.message === "format"
      ? t(`hint.period.${template}`)
      : t(`error.${error.message === "required" ? "required" : "invalid"}`);
  const errorText = (path: string) => {
    const error = errorFor(path);
    return error ? message(error) : undefined;
  };
  const describedBy = (path: string, hint?: string) =>
    [hint, errorFor(path) ? `${fieldId(path)}-error` : undefined].filter(Boolean).join(" ") ||
    undefined;

  const choose = (next: ReportTemplate) => {
    setTemplate(next);
    const nextPeriod = lastPeriod(next);
    setPeriod(nextPeriod);
    if (!titleEdited) setTitle(t(`defaultTitle.${next}`, { period: nextPeriod }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const created = await bff<ReportAdmin>("/reports", {
        method: "POST",
        body: { template, period, title },
      });
      showToast(t("created"));
      router.push(`/reports/${created.id}`);
    } catch (error) {
      if (error instanceof BffError && error.status === 422) {
        setErrors(error.errors);
        requestAnimationFrame(() => summary.current?.focus());
      } else showToast(t("saveFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex max-w-3xl flex-col gap-5">
      <ErrorSummary
        ref={summary}
        title={t("errorTitle", { count: errors.length })}
        items={errors.map((error) => ({
          href: `#${fieldId(error.path)}`,
          text: t("errorLine", {
            field: t(`field.${error.path as "title"}`),
            message: message(error),
          }),
        }))}
      />
      <fieldset>
        <legend className="text-h4">{t("field.template")}</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((item) => (
            <div
              key={item}
              className={cn(
                "rounded-lg border p-4",
                template === item && "border-primary border-2",
              )}
            >
              <label
                htmlFor={fieldId(`template-${item}`)}
                className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold"
              >
                <input
                  id={fieldId(`template-${item}`)}
                  type="radio"
                  name={fieldId("template")}
                  className="size-4 shrink-0"
                  checked={template === item}
                  aria-describedby={fieldId(`template-${item}-help`)}
                  onChange={() => choose(item)}
                />
                {t(`template.${item}`)}
              </label>
              <p
                id={fieldId(`template-${item}-help`)}
                className="text-muted-foreground ps-7 text-sm"
              >
                {t(`templateHelp.${item}`)}
              </p>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <label htmlFor={fieldId("title")} className="mb-1 block font-semibold">
            {t("field.title")}
          </label>
          <input
            id={fieldId("title")}
            className={FIELD}
            value={title}
            aria-invalid={Boolean(errorFor("title"))}
            aria-describedby={describedBy("title")}
            onChange={(event) => {
              setTitleEdited(true);
              setTitle(event.target.value);
            }}
          />
          <FieldMessage id={`${fieldId("title")}-error`} text={errorText("title")} />
        </div>
        <div>
          <label htmlFor={fieldId("period")} className="mb-1 block font-semibold">
            {t("field.period")}
          </label>
          <input
            id={fieldId("period")}
            className={`${FIELD} font-mono`}
            value={period}
            autoComplete="off"
            aria-invalid={Boolean(errorFor("period"))}
            aria-describedby={describedBy("period", `${fieldId("period")}-hint`)}
            onChange={(event) => {
              const next = event.target.value.toUpperCase();
              setPeriod(next);
              if (!titleEdited) setTitle(t(`defaultTitle.${template}`, { period: next }));
            }}
          />
          <p id={`${fieldId("period")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {t(`hint.period.${template}`)}
          </p>
          <FieldMessage id={`${fieldId("period")}-error`} text={errorText("period")} />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={busy}>
          {busy && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
          {t("create")}
        </Button>
      </div>
    </form>
  );
}
