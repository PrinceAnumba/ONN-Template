"use client";

import type { DashboardAdmin, DashboardCreateInput } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ErrorSummary, FIELD, FieldMessage, type FieldError } from "@/components/forms/form-errors";
import { bff, BffError } from "@/lib/bff";
import { AUDIENCES, slugify } from "@/lib/content";
import { useLanguageName } from "@/lib/languages";

/** Creates a draft dashboard, then opens the builder. */
export function NewDashboardForm({
  locales,
  defaultLocale,
}: {
  locales: string[];
  defaultLocale: string;
}) {
  const t = useTranslations("Admin.dashboards");
  const router = useRouter();
  const id = useId();
  const languageName = useLanguageName();
  const [input, setInput] = useState<DashboardCreateInput>({
    slug: "",
    title: {},
    audience: "public",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const errorFor = (path: string) => errors.find((error) => error.path === path);
  const message = (error: FieldError) =>
    t(
      `error.${["required", "duplicate", "format"].includes(error.message) ? (error.message as "required") : "invalid"}`,
    );
  const label = (path: string) =>
    path.startsWith("title.")
      ? t("fieldIn", { field: t("field.title"), language: languageName(path.slice(6)) })
      : t(`field.${path as "slug" | "audience"}`);
  const describedBy = (path: string, hint?: string) =>
    [hint, errorFor(path) ? `${fieldId(path)}-error` : undefined].filter(Boolean).join(" ") ||
    undefined;
  const errorText = (path: string) => {
    const error = errorFor(path);
    return error ? message(error) : undefined;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const created = await bff<DashboardAdmin>("/dashboards", { method: "POST", body: input });
      showToast(t("created"));
      router.push(`/dashboards/${created.slug}`);
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
          text: t("errorLine", { field: label(error.path), message: message(error) }),
        }))}
      />
      <fieldset>
        <legend className="text-h4">{t("field.title")}</legend>
        <div className="mt-2 grid gap-4 md:grid-cols-3">
          {locales.map((code) => {
            const path = `title.${code}`;
            return (
              <div key={code}>
                <label htmlFor={fieldId(path)} className="mb-1 block font-semibold">
                  {languageName(code)}
                  {code === defaultLocale && (
                    <span className="text-muted-foreground ms-1 text-sm font-normal">
                      {t("requiredSuffix")}
                    </span>
                  )}
                </label>
                <input
                  id={fieldId(path)}
                  lang={code}
                  className={FIELD}
                  value={input.title[code] ?? ""}
                  aria-invalid={Boolean(errorFor(path))}
                  aria-describedby={describedBy(path)}
                  onChange={(event) => {
                    const title = { ...input.title, [code]: event.target.value };
                    const slug =
                      code === defaultLocale && !slugEdited
                        ? slugify(event.target.value)
                        : input.slug;
                    setInput({ ...input, title, slug });
                  }}
                />
                <FieldMessage id={`${fieldId(path)}-error`} text={errorText(path)} />
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={fieldId("slug")} className="mb-1 block font-semibold">
            {t("field.slug")}
          </label>
          <input
            id={fieldId("slug")}
            className={`${FIELD} font-mono`}
            value={input.slug}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(errorFor("slug"))}
            aria-describedby={describedBy("slug", `${fieldId("slug")}-hint`)}
            onChange={(event) => {
              setSlugEdited(true);
              setInput({ ...input, slug: event.target.value.toLowerCase() });
            }}
          />
          <p id={`${fieldId("slug")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {t("hint.slug")}
          </p>
          <FieldMessage id={`${fieldId("slug")}-error`} text={errorText("slug")} />
        </div>
        <div>
          <label htmlFor={fieldId("audience")} className="mb-1 block font-semibold">
            {t("field.audience")}
          </label>
          <select
            id={fieldId("audience")}
            className={FIELD}
            value={input.audience}
            onChange={(event) =>
              setInput({
                ...input,
                audience: event.target.value as DashboardCreateInput["audience"],
              })
            }
          >
            {AUDIENCES.map((audience) => (
              <option key={audience} value={audience}>
                {t(`audience.${audience}`)}
              </option>
            ))}
          </select>
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
