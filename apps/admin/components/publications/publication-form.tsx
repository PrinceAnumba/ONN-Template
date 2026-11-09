"use client";

import type { PublicationAdmin, PublicationRecord } from "@onn/api-client/types";
import { FileDrop } from "@onn/ui/components/file-drop";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { ErrorSummary, FIELD, FieldMessage, type FieldError } from "@/components/forms/form-errors";
import { bff, BffError, uploadForm } from "@/lib/bff";
import { PERIOD_PATTERN, PUBLICATION_TYPES, slugify } from "@/lib/content";
import { formatBytes } from "@/lib/format";
import { useLanguageName } from "@/lib/languages";

const AREA = "border-input bg-background min-h-24 w-full rounded-md border px-3 py-2";
export const PDF_MAX = 50 * 1024 * 1024;
export const COVER_MAX = 2 * 1024 * 1024;
export const COVER_TYPES = [".png", ".jpg", ".jpeg", ".webp"];

type Mode =
  { kind: "create" } | { kind: "edit"; slug: string; onSaved: (item: PublicationAdmin) => void };

interface PublicationFormProps {
  mode: Mode;
  initial?: PublicationRecord;
  pillars: { code: string; name: string }[];
  locales: string[];
  defaultLocale: string;
  disabled?: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Metadata per language, type, period, pillar and date; on creation also the PDF and cover. */
export function PublicationForm({
  mode,
  initial,
  pillars,
  locales,
  defaultLocale,
  disabled,
}: PublicationFormProps) {
  const t = useTranslations("Admin.publications");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const languageName = useLanguageName();
  const creating = mode.kind === "create";
  const [input, setInput] = useState<PublicationRecord>(
    initial ?? { title: {}, summary: {}, type: "quarterly", period: "", date: today() },
  );
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [coverError, setCoverError] = useState<string>();
  const [progress, setProgress] = useState<number>();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const summary = useRef<HTMLDivElement>(null);

  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const errorFor = (path: string) => errors.find((error) => error.path === path);
  const message = (error: FieldError) =>
    error.path === "period" && error.message === "format"
      ? t(`hint.period.${input.type}`)
      : t(
          `error.${
            ["required", "duplicate", "format", "type", "size", "empty"].includes(error.message)
              ? (error.message as "required")
              : "invalid"
          }`,
        );
  const label = (path: string) => {
    const [name, language] = path.split(".");
    const base = t(`field.${(name ?? path) as "title"}`);
    return language ? t("fieldIn", { field: base, language: languageName(language) }) : base;
  };
  const errorText = (path: string) => {
    const error = errorFor(path);
    return error ? message(error) : undefined;
  };
  const describedBy = (path: string, hint?: string) =>
    [hint, errorFor(path) ? `${fieldId(path)}-error` : undefined].filter(Boolean).join(" ") ||
    undefined;
  const fileReject = (set: (text: string) => void, max: number) => (reason: "type" | "size") =>
    set(
      reason === "type" ? t("error.type") : t("error.sizeMax", { size: formatBytes(max, locale) }),
    );
  const fileLabel = (picked: File | null) =>
    picked
      ? t("fileLabel", { name: picked.name, size: formatBytes(picked.size, locale) })
      : undefined;
  const dropLabels = (hint: string) => ({
    prompt: t("drop.prompt"),
    browse: t("drop.browse"),
    hint,
    remove: t("drop.remove"),
    progress: t("drop.progress"),
  });

  const fail = (error: unknown) => {
    if (error instanceof BffError && error.status === 422 && error.errors.length) {
      setErrors(error.errors);
      setFileError(error.errors.some((item) => item.path === "file") ? undefined : fileError);
      requestAnimationFrame(() => summary.current?.focus());
    } else showToast(t("saveFailed"), "error");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);
    setBusy(true);
    try {
      if (mode.kind === "create") {
        const form = new FormData();
        form.set("meta", JSON.stringify({ ...input, slug }));
        if (file) form.set("file", file);
        if (cover) form.set("cover", cover);
        setProgress(0);
        const created = await uploadForm<PublicationAdmin>("/publications", form, setProgress);
        showToast(t("created"));
        router.push(`/publications/${created.slug}`);
      } else {
        const saved = await bff<PublicationAdmin>(`/publications/${mode.slug}`, {
          method: "PUT",
          body: input,
        });
        mode.onSaved(saved);
        showToast(t("saved"));
      }
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  };

  const textFields = (name: "title" | "summary") => (
    <fieldset>
      <legend className="text-h4">{t(`field.${name}`)}</legend>
      <div className="mt-2 grid gap-4 md:grid-cols-3">
        {locales.map((code) => {
          const path = `${name}.${code}`;
          const shared = {
            id: fieldId(path),
            lang: code,
            value: input[name][code] ?? "",
            "aria-invalid": Boolean(errorFor(path)),
            "aria-describedby": describedBy(path),
          };
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
              {name === "title" ? (
                <input
                  {...shared}
                  className={FIELD}
                  onChange={(event) => {
                    setInput({ ...input, title: { ...input.title, [code]: event.target.value } });
                    if (creating && code === defaultLocale && !slugEdited)
                      setSlug(slugify(event.target.value));
                  }}
                />
              ) : (
                <textarea
                  {...shared}
                  className={AREA}
                  onChange={(event) =>
                    setInput({
                      ...input,
                      summary: { ...input.summary, [code]: event.target.value },
                    })
                  }
                />
              )}
              <FieldMessage id={`${fieldId(path)}-error`} text={errorText(path)} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );

  const periodHint = PERIOD_PATTERN[input.type]
    ? t(`hint.period.${input.type}`)
    : t("hint.period.other");

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <ErrorSummary
        ref={summary}
        title={t("errorTitle", { count: errors.length })}
        items={errors.map((error) => ({
          href: `#${fieldId(error.path)}`,
          text: t("errorLine", { field: label(error.path), message: message(error) }),
        }))}
      />
      <fieldset disabled={disabled} className="flex flex-col gap-5">
        {creating && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <span className="mb-1 block font-semibold" id={`${fieldId("file")}-label`}>
                {t("field.file")}
              </span>
              <div
                role="group"
                id={fieldId("file")}
                tabIndex={-1}
                aria-labelledby={`${fieldId("file")}-label`}
              >
                <FileDrop
                  accept={[".pdf"]}
                  maxBytes={PDF_MAX}
                  file={file}
                  fileLabel={fileLabel(file)}
                  onFile={(picked) => {
                    setFile(picked);
                    setFileError(undefined);
                  }}
                  onReject={fileReject(setFileError, PDF_MAX)}
                  onClear={() => setFile(null)}
                  error={fileError ?? errorText("file")}
                  progress={progress}
                  disabled={busy}
                  labels={dropLabels(t("hint.file", { size: formatBytes(PDF_MAX, locale) }))}
                />
              </div>
            </div>
            <div>
              <span className="mb-1 block font-semibold" id={`${fieldId("cover")}-label`}>
                {t("field.cover")}
                <span className="text-muted-foreground ms-1 text-sm font-normal">
                  {t("optional")}
                </span>
              </span>
              <div
                role="group"
                id={fieldId("cover")}
                tabIndex={-1}
                aria-labelledby={`${fieldId("cover")}-label`}
              >
                <FileDrop
                  accept={COVER_TYPES}
                  maxBytes={COVER_MAX}
                  file={cover}
                  fileLabel={fileLabel(cover)}
                  onFile={(picked) => {
                    setCover(picked);
                    setCoverError(undefined);
                  }}
                  onReject={fileReject(setCoverError, COVER_MAX)}
                  onClear={() => setCover(null)}
                  error={coverError ?? errorText("cover")}
                  disabled={busy}
                  labels={dropLabels(t("hint.cover", { size: formatBytes(COVER_MAX, locale) }))}
                />
              </div>
            </div>
          </div>
        )}
        {textFields("title")}
        {textFields("summary")}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor={fieldId("type")} className="mb-1 block font-semibold">
              {t("field.type")}
            </label>
            <select
              id={fieldId("type")}
              className={FIELD}
              value={input.type}
              onChange={(event) =>
                setInput({ ...input, type: event.target.value as PublicationRecord["type"] })
              }
            >
              {PUBLICATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`type.${type}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={fieldId("period")} className="mb-1 block font-semibold">
              {t("field.period")}
            </label>
            <input
              id={fieldId("period")}
              className={`${FIELD} font-mono`}
              value={input.period}
              autoComplete="off"
              aria-invalid={Boolean(errorFor("period"))}
              aria-describedby={describedBy("period", `${fieldId("period")}-hint`)}
              onChange={(event) => setInput({ ...input, period: event.target.value.toUpperCase() })}
            />
            <p id={`${fieldId("period")}-hint`} className="text-muted-foreground mt-1 text-sm">
              {periodHint}
            </p>
            <FieldMessage id={`${fieldId("period")}-error`} text={errorText("period")} />
          </div>
          <div>
            <label htmlFor={fieldId("date")} className="mb-1 block font-semibold">
              {t("field.date")}
            </label>
            <input
              id={fieldId("date")}
              type="date"
              className={FIELD}
              value={input.date}
              aria-invalid={Boolean(errorFor("date"))}
              aria-describedby={describedBy("date")}
              onChange={(event) => setInput({ ...input, date: event.target.value })}
            />
            <FieldMessage id={`${fieldId("date")}-error`} text={errorText("date")} />
          </div>
          <div>
            <label htmlFor={fieldId("pillar")} className="mb-1 block font-semibold">
              {t("field.pillar")}
            </label>
            <select
              id={fieldId("pillar")}
              className={FIELD}
              value={input.pillar ?? ""}
              onChange={(event) => setInput({ ...input, pillar: event.target.value || undefined })}
            >
              <option value="">{t("noPillar")}</option>
              {pillars.map((pillar) => (
                <option key={pillar.code} value={pillar.code}>
                  {pillar.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {creating && (
          <div className="max-w-md">
            <label htmlFor={fieldId("slug")} className="mb-1 block font-semibold">
              {t("field.slug")}
            </label>
            <input
              id={fieldId("slug")}
              className={`${FIELD} font-mono`}
              value={slug}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(errorFor("slug"))}
              aria-describedby={describedBy("slug", `${fieldId("slug")}-hint`)}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(event.target.value.toLowerCase());
              }}
            />
            <p id={`${fieldId("slug")}-hint`} className="text-muted-foreground mt-1 text-sm">
              {t("hint.slug")}
            </p>
            <FieldMessage id={`${fieldId("slug")}-error`} text={errorText("slug")} />
          </div>
        )}
        <div>
          <Button type="submit" disabled={busy}>
            {busy && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
            {creating ? t("upload") : t("save")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
