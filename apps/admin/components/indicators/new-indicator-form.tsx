"use client";

import type { IndicatorAdmin, IndicatorCreateInput } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { tagFor } from "@onn/config/locale";
import { LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { bff, BffError } from "@/lib/bff";
import type { EditorPillar } from "./indicator-editor";

const FIELD = "border-input bg-background h-11 w-full rounded-md border px-3";
type FieldError = { path: string; message: string };

interface NewIndicatorFormProps {
  pillars: EditorPillar[];
  orgs: { code: string; name: string }[];
  locales: string[];
  defaultLocale: string;
}

/** Creates a planned indicator, then opens it in the editor. */
export function NewIndicatorForm({ pillars, orgs, locales, defaultLocale }: NewIndicatorFormProps) {
  const t = useTranslations("Admin.indicators");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [input, setInput] = useState<IndicatorCreateInput>({
    code: "",
    name: {},
    pillar: pillars[0]?.code ?? "",
    theme: pillars[0]?.themes[0]?.code ?? "",
    org: orgs[0]?.code ?? "",
  });
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const summary = useRef<HTMLDivElement>(null);
  const languageName = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([tagFor(locale)], { type: "language" });
    } catch {
      names = null;
    }
    return (code: string) => {
      const name = names?.of(code);
      return name && name !== code ? name : code.toUpperCase();
    };
  }, [locale]);
  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const errorFor = (path: string) => errors.find((error) => error.path === path);
  const message = (error: FieldError) =>
    error.path === "code" && error.message === "format"
      ? t("error.code")
      : t(`error.${["required", "duplicate"].includes(error.message) ? error.message : "format"}`);
  const label = (path: string) =>
    path.startsWith("name.")
      ? t("fieldIn", { field: t("field.name"), language: languageName(path.slice(5)) })
      : t(`field.${path}`);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setErrors([]);
    try {
      const created = await bff<IndicatorAdmin>("/indicators", { method: "POST", body: input });
      showToast(t("created", { code: created.code }));
      router.push(`/indicators/${encodeURIComponent(created.code)}`);
    } catch (error) {
      if (error instanceof BffError && error.status === 422) {
        setErrors(error.errors);
        requestAnimationFrame(() => summary.current?.focus());
      } else {
        showToast(t("saveFailed"), "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const pillar = pillars.find((item) => item.code === input.pillar);
  const describedBy = (path: string, hint?: string) =>
    [hint, errorFor(path) ? `${fieldId(path)}-error` : undefined].filter(Boolean).join(" ") ||
    undefined;
  const errorLine = (path: string) => {
    const error = errorFor(path);
    return error ? (
      <p id={`${fieldId(path)}-error`} className="text-destructive mt-1 text-sm">
        {message(error)}
      </p>
    ) : null;
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 flex max-w-3xl flex-col gap-5">
      {errors.length > 0 && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          aria-labelledby={`${id}-summary`}
          className="border-destructive rounded-lg border-2 p-4"
        >
          <h2 id={`${id}-summary`} className="text-h4">
            {t("errorTitle", { count: errors.length })}
          </h2>
          <ul className="mt-2 list-disc ps-5">
            {errors.map((error) => (
              <li key={error.path}>
                <a href={`#${fieldId(error.path)}`} className="underline">
                  {t("errorLineShort", { field: label(error.path), message: message(error) })}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <label htmlFor={fieldId("code")} className="mb-1 block font-semibold">
          {t("field.code")}
        </label>
        <input
          id={fieldId("code")}
          className={`${FIELD} max-w-sm font-mono uppercase`}
          value={input.code}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errorFor("code"))}
          aria-describedby={describedBy("code", `${fieldId("code")}-hint`)}
          onChange={(event) => setInput({ ...input, code: event.target.value.toUpperCase() })}
        />
        <p id={`${fieldId("code")}-hint`} className="text-muted-foreground mt-1 text-sm">
          {t("hint.code")}
        </p>
        {errorLine("code")}
      </div>
      <fieldset>
        <legend className="text-h4">{t("field.name")}</legend>
        <div className="mt-2 grid gap-4 md:grid-cols-3">
          {locales.map((code) => {
            const path = `name.${code}`;
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
                  value={input.name[code] ?? ""}
                  aria-invalid={Boolean(errorFor(path))}
                  aria-describedby={describedBy(path)}
                  onChange={(event) =>
                    setInput({ ...input, name: { ...input.name, [code]: event.target.value } })
                  }
                />
                {errorLine(path)}
              </div>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor={fieldId("pillar")} className="mb-1 block font-semibold">
            {t("field.pillar")}
          </label>
          <select
            id={fieldId("pillar")}
            className={FIELD}
            value={input.pillar}
            onChange={(event) => {
              const next = pillars.find((item) => item.code === event.target.value);
              setInput({
                ...input,
                pillar: event.target.value,
                theme: next?.themes[0]?.code ?? "",
              });
            }}
          >
            {pillars.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={fieldId("theme")} className="mb-1 block font-semibold">
            {t("field.theme")}
          </label>
          <select
            id={fieldId("theme")}
            className={FIELD}
            value={input.theme}
            onChange={(event) => setInput({ ...input, theme: event.target.value })}
          >
            {(pillar?.themes ?? []).map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={fieldId("org")} className="mb-1 block font-semibold">
            {t("field.org")}
          </label>
          <select
            id={fieldId("org")}
            className={FIELD}
            value={input.org}
            onChange={(event) => setInput({ ...input, org: event.target.value })}
          >
            {orgs.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
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
