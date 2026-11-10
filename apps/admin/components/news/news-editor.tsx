"use client";

import type { NewsAdmin, NewsRecord } from "@onn/api-client/types";
import { StatusPill } from "@onn/ui/components/status-pill";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { ExternalLinkIcon, LoaderCircleIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AREA,
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  focusField,
  useFormErrors,
} from "@/components/forms/form-errors";
import { ImageField } from "@/components/forms/image-field";
import { LanguageSwitch } from "@/components/forms/language-switch";
import { RichText } from "@/components/forms/rich-text";
import { bff } from "@/lib/bff";
import { portalUrl, slugify } from "@/lib/content";
import { localToIso, MAX_TAGS, NEWS_TONE, splitList } from "@/lib/editorial";
import { formatDate, formatTime } from "@/lib/format";
import { useLanguageName } from "@/lib/languages";
import { useUnsavedWarning } from "@/lib/use-unsaved";

type TextField = "title" | "excerpt" | "body";
const today = () => new Date().toISOString().slice(0, 10);
const record = (item: NewsAdmin): NewsRecord => ({
  title: item.title,
  excerpt: item.excerpt,
  body: item.body,
  tags: item.tags,
  date: item.date,
  sourceUrl: item.sourceUrl,
  imageUrl: item.imageUrl,
});

/**
 * Article editor (brief §7): text per language, picture, tags, and publishing now or at a set
 * time. Saving a live article updates the portal at once; a draft stays private until published.
 */
export function NewsEditor({
  initial,
  locales,
  defaultLocale,
}: {
  /** Absent while creating. */
  initial?: NewsAdmin;
  locales: string[];
  defaultLocale: string;
}) {
  const t = useTranslations("Admin.news");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const router = useRouter();
  const languageName = useLanguageName();
  const form = useFormErrors();
  const [item, setItem] = useState(initial);
  const [input, setInput] = useState<NewsRecord>(
    initial ? record(initial) : { title: {}, excerpt: {}, body: {}, tags: [], date: today() },
  );
  const [tags, setTags] = useState(input.tags.join(", "));
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [language, setLanguage] = useState(defaultLocale);
  const [at, setAt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | "unpublish" | null>(null);
  useUnsavedWarning(dirty);

  const change = (patch: Partial<NewsRecord>) => {
    setInput((current) => ({ ...current, ...patch }));
    setDirty(true);
  };
  const setText = (name: TextField, value: string) =>
    change({ [name]: { ...input[name], [language]: value } });
  const label = (path: string) => {
    const [name, code] = path.split(".");
    const base = t(`field.${name as "title"}`);
    return code ? forms("fieldIn", { field: base, language: languageName(code) }) : base;
  };
  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };
  const flagged = locales.filter((code) =>
    form.errors.some((error) => error.path.endsWith(`.${code}`)),
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    form.clear();
    setBusy("save");
    const body = { ...input, tags: splitList(tags) };
    try {
      if (item) {
        const saved = await bff<NewsAdmin>(`/news/${item.slug}`, { method: "PUT", body });
        setItem(saved);
        setInput(record(saved));
        setTags(saved.tags.join(", "));
        setDirty(false);
        showToast(t(saved.status === "published" ? "savedLive" : "saved"));
      } else {
        const created = await bff<NewsAdmin>("/news", { method: "POST", body: { ...body, slug } });
        setDirty(false);
        showToast(t("created"));
        router.push(`/news/${created.slug}`);
      }
    } catch (error) {
      if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const scheduleAt = localToIso(at);
  const scheduling = Boolean(scheduleAt && Date.parse(scheduleAt) > Date.now());
  const act = async (action: "publish" | "unpublish", when?: string) => {
    if (!item) return;
    setBusy(action);
    form.clear();
    try {
      const next = await bff<NewsAdmin>(`/news/${item.slug}/${action}`, {
        method: "POST",
        body: when ? { at: when } : {},
      });
      setItem(next);
      setAt("");
      showToast(
        t(
          action === "unpublish"
            ? item.status === "scheduled"
              ? "unscheduledToast"
              : "unpublishedToast"
            : next.status === "scheduled"
              ? "scheduledToast"
              : "publishedToast",
        ),
      );
      // Focus the control that replaced the one just used.
      focusField(form.fieldId(action === "unpublish" ? "publish" : "unpublish"));
    } catch (error) {
      if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const heading = item
    ? item.title[locale] || item.title[defaultLocale] || item.slug
    : t("newTitle");
  const stamp = (value: string) =>
    forms("dateTime", {
      date: formatDate(value, locale, "medium"),
      time: formatTime(value, locale),
    });

  return (
    <div className="mt-2 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1 break-words">{heading}</h1>
          {item && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill tone={NEWS_TONE[item.status]} label={t(`status.${item.status}`)} />
              <StatusPill label={t(`kind.${item.kind}`)} />
              {item.status === "scheduled" && item.publishAt && (
                <span className="text-sm">
                  {t("scheduledFor", { when: stamp(item.publishAt) })}
                </span>
              )}
            </div>
          )}
        </div>
        {item?.status === "published" && (
          <a
            href={portalUrl(`/${locale}/news/${item.slug}`)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-md px-3 underline"
          >
            {forms("viewOnPortal")}
            <ExternalLinkIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">{forms("newWindow")}</span>
          </a>
        )}
      </div>

      <form onSubmit={save} noValidate className="flex flex-col gap-5">
        <ErrorSummary
          ref={form.summary}
          title={forms("errorTitle", { count: form.errors.length })}
          items={form.errors.map((error) => {
            const code = error.path.split(".")[1];
            return {
              href: `#${form.fieldId(error.path)}`,
              text: forms("errorLine", {
                field: error.path === "at" ? t("field.publishAt") : label(error.path),
                message: forms(`error.${errorCode(error.message)}`),
              }),
              onClick: () => {
                if (code && locales.includes(code)) setLanguage(code);
                focusField(form.fieldId(error.path));
              },
            };
          })}
        />
        <LanguageSwitch
          locales={locales}
          value={language}
          onChange={setLanguage}
          flagged={flagged}
        />
        <div lang={language} className="flex flex-col gap-5">
          <div>
            <label htmlFor={form.fieldId(`title.${language}`)} className="mb-1 block font-semibold">
              {label(`title.${language}`)}
              {language === defaultLocale && (
                <span className="text-muted-foreground ms-1 text-sm font-normal">
                  {forms("required")}
                </span>
              )}
            </label>
            <input
              id={form.fieldId(`title.${language}`)}
              className={FIELD}
              value={input.title[language] ?? ""}
              aria-invalid={Boolean(form.errorFor(`title.${language}`))}
              aria-describedby={form.describedBy(`title.${language}`)}
              onChange={(event) => {
                setText("title", event.target.value);
                if (!item && language === defaultLocale && !slugEdited)
                  setSlug(slugify(event.target.value));
              }}
            />
            <FieldMessage
              id={`${form.fieldId(`title.${language}`)}-error`}
              text={errorText(`title.${language}`)}
            />
          </div>
          <div>
            <label
              htmlFor={form.fieldId(`excerpt.${language}`)}
              className="mb-1 block font-semibold"
            >
              {label(`excerpt.${language}`)}
            </label>
            <textarea
              id={form.fieldId(`excerpt.${language}`)}
              className={AREA}
              value={input.excerpt[language] ?? ""}
              aria-invalid={Boolean(form.errorFor(`excerpt.${language}`))}
              aria-describedby={form.describedBy(
                `excerpt.${language}`,
                `${form.fieldId("excerpt")}-hint`,
              )}
              onChange={(event) => setText("excerpt", event.target.value)}
            />
            <p
              id={`${form.fieldId("excerpt")}-hint`}
              className="text-muted-foreground mt-1 text-sm"
            >
              {t("hint.excerpt")}
            </p>
            <FieldMessage
              id={`${form.fieldId(`excerpt.${language}`)}-error`}
              text={errorText(`excerpt.${language}`)}
            />
          </div>
          <div id={form.fieldId(`body.${language}`)} tabIndex={-1}>
            <RichText
              key={language}
              label={label(`body.${language}`)}
              value={input.body[language] ?? ""}
              onChange={(html) => {
                // The editor reports once on load; only a real edit makes the form dirty.
                if (html !== (input.body[language] ?? "")) setText("body", html);
              }}
              error={errorText(`body.${language}`)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={form.fieldId("tags")} className="mb-1 block font-semibold">
              {t("field.tags")}
            </label>
            <input
              id={form.fieldId("tags")}
              className={FIELD}
              value={tags}
              autoComplete="off"
              aria-invalid={Boolean(form.errorFor("tags"))}
              aria-describedby={form.describedBy("tags", `${form.fieldId("tags")}-hint`)}
              onChange={(event) => {
                setTags(event.target.value);
                setDirty(true);
              }}
            />
            <p id={`${form.fieldId("tags")}-hint`} className="text-muted-foreground mt-1 text-sm">
              {t("hint.tags", { max: MAX_TAGS })}
            </p>
            <FieldMessage id={`${form.fieldId("tags")}-error`} text={errorText("tags")} />
          </div>
          <div>
            <label htmlFor={form.fieldId("date")} className="mb-1 block font-semibold">
              {t("field.date")}
            </label>
            <input
              id={form.fieldId("date")}
              type="date"
              className={FIELD}
              value={input.date}
              aria-invalid={Boolean(form.errorFor("date"))}
              aria-describedby={form.describedBy("date")}
              onChange={(event) => change({ date: event.target.value })}
            />
            <FieldMessage id={`${form.fieldId("date")}-error`} text={errorText("date")} />
          </div>
          <div>
            <label htmlFor={form.fieldId("sourceUrl")} className="mb-1 block font-semibold">
              {t("field.sourceUrl")}
              <span className="text-muted-foreground ms-1 text-sm font-normal">
                {forms("optional")}
              </span>
            </label>
            <input
              id={form.fieldId("sourceUrl")}
              type="url"
              inputMode="url"
              className={FIELD}
              value={input.sourceUrl ?? ""}
              aria-invalid={Boolean(form.errorFor("sourceUrl"))}
              aria-describedby={form.describedBy("sourceUrl", `${form.fieldId("sourceUrl")}-hint`)}
              onChange={(event) => change({ sourceUrl: event.target.value || undefined })}
            />
            <p
              id={`${form.fieldId("sourceUrl")}-hint`}
              className="text-muted-foreground mt-1 text-sm"
            >
              {t("hint.sourceUrl")}
            </p>
            <FieldMessage id={`${form.fieldId("sourceUrl")}-error`} text={errorText("sourceUrl")} />
          </div>
          {!item && (
            <div>
              <label htmlFor={form.fieldId("slug")} className="mb-1 block font-semibold">
                {t("field.slug")}
              </label>
              <input
                id={form.fieldId("slug")}
                className={`${FIELD} font-mono`}
                value={slug}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(form.errorFor("slug"))}
                aria-describedby={form.describedBy("slug", `${form.fieldId("slug")}-hint`)}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value.toLowerCase());
                }}
              />
              <p id={`${form.fieldId("slug")}-hint`} className="text-muted-foreground mt-1 text-sm">
                {t("hint.slug")}
              </p>
              <FieldMessage id={`${form.fieldId("slug")}-error`} text={errorText("slug")} />
            </div>
          )}
        </div>
        <div className="max-w-xl">
          <ImageField
            id={form.fieldId("imageUrl")}
            label={t("field.imageUrl")}
            value={input.imageUrl}
            onChange={(url) => change({ imageUrl: url })}
            error={errorText("imageUrl")}
            optional
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy !== null}>
            {busy === "save" && (
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            )}
            {item ? forms("save") : t("create")}
          </Button>
          <p role="status" className="text-muted-foreground text-sm">
            {dirty ? forms("unsaved") : ""}
          </p>
        </div>
      </form>

      {item && (
        <section aria-labelledby={form.fieldId("publishing")} className="rounded-lg border p-4">
          <h2 id={form.fieldId("publishing")} className="text-h3">
            {t("publishing")}
          </h2>
          {item.status === "published" ? (
            <div className="mt-3 flex flex-col items-start gap-2">
              <p>{t("liveHelp")}</p>
              <Button
                id={form.fieldId("unpublish")}
                variant="secondary"
                disabled={busy !== null}
                onClick={() => act("unpublish")}
              >
                {busy === "unpublish" && (
                  <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                )}
                {forms("unpublish")}
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {item.status === "scheduled" && item.publishAt && (
                <div className="flex flex-wrap items-center gap-3">
                  <p>{t("scheduledFor", { when: stamp(item.publishAt) })}</p>
                  <Button
                    id={form.fieldId("unpublish")}
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => act("unpublish")}
                  >
                    {busy === "unpublish" && (
                      <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                    )}
                    {t("unschedule")}
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={form.fieldId("at")} className="mb-1 block font-semibold">
                    {t("field.publishAt")}
                    <span className="text-muted-foreground ms-1 text-sm font-normal">
                      {forms("optional")}
                    </span>
                  </label>
                  <input
                    id={form.fieldId("at")}
                    type="datetime-local"
                    className={FIELD}
                    value={at}
                    aria-describedby={`${form.fieldId("at")}-hint`}
                    onChange={(event) => setAt(event.target.value)}
                  />
                </div>
                <Button
                  id={form.fieldId("publish")}
                  disabled={busy !== null}
                  aria-disabled={dirty || undefined}
                  aria-describedby={dirty ? `${form.fieldId("publish")}-reason` : undefined}
                  className={dirty ? "cursor-not-allowed opacity-60" : undefined}
                  onClick={() => !dirty && act("publish", scheduling ? scheduleAt : undefined)}
                >
                  {busy === "publish" && (
                    <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                  )}
                  {scheduling ? t("schedule") : t("publishNow")}
                </Button>
              </div>
              <p id={`${form.fieldId("at")}-hint`} className="text-muted-foreground text-sm">
                {t("hint.publishAt")}
              </p>
              {dirty && (
                <p id={`${form.fieldId("publish")}-reason`} className="text-sm">
                  {forms("saveFirst")}
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
