"use client";

import type {
  Campaign,
  CampaignInput,
  CampaignItem,
  CampaignOptions,
  CampaignPreview,
} from "@onn/api-client/types";
import { Combobox } from "@onn/ui/components/combobox";
import { StatusPill } from "@onn/ui/components/status-pill";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { cn } from "@onn/ui/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import {
  AREA,
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  focusField,
  useFormErrors,
} from "@/components/forms/form-errors";
import { LanguageSwitch } from "@/components/forms/language-switch";
import { useDebounced } from "@/components/preview/preview-frame";
import { bff, BffError } from "@/lib/bff";
import { CAMPAIGN_TONE, localToIso, MAX_CAMPAIGN_ITEMS } from "@/lib/editorial";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { useLanguageName } from "@/lib/languages";
import { useUnsavedWarning } from "@/lib/use-unsaved";

const keyOf = (item: CampaignItem) => `${item.kind}:${item.slug}`;
const toggle = (list: string[], item: string, on: boolean) =>
  on ? [...list, item] : list.filter((entry) => entry !== item);
const input = (item: Campaign): CampaignInput => ({
  subject: item.subject,
  intro: item.intro,
  items: item.items,
  audience: item.audience,
});

/**
 * Newsletter composer (brief §7): pick published items, narrow the audience, preview the email
 * at desktop and phone widths, then send now or at a set time. A sent newsletter is read-only
 * and shows its open and click rates.
 */
export function CampaignComposer({
  initial,
  options,
  locales,
  defaultLocale,
}: {
  /** Absent while creating. */
  initial?: Campaign;
  options: CampaignOptions;
  locales: string[];
  defaultLocale: string;
}) {
  const t = useTranslations("Admin.newsletter");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const router = useRouter();
  const languageName = useLanguageName();
  const form = useFormErrors();
  const [item, setItem] = useState(initial);
  const [draft, setDraft] = useState<CampaignInput>(
    initial
      ? input(initial)
      : { subject: {}, intro: {}, items: [], audience: { locales: [], topics: [] } },
  );
  const [language, setLanguage] = useState(defaultLocale);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = useState<CampaignPreview>();
  const [at, setAt] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "send" | "unschedule" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  useUnsavedWarning(dirty);
  const locked = Boolean(item && item.status !== "draft");

  const change = (patch: Partial<CampaignInput>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };
  const titles = useMemo(
    () => new Map(options.choices.map((choice) => [keyOf(choice), choice.title])),
    [options.choices],
  );
  const titleOf = (entry: CampaignItem) => titles.get(keyOf(entry)) ?? entry.slug;

  // The email is the backend's template, so the preview asks for it (unsaved content included).
  const request = useDebounced(JSON.stringify({ campaign: draft, locale: language }), 500);
  useEffect(() => {
    const controller = new AbortController();
    bff<CampaignPreview>("/newsletter/preview", {
      method: "POST",
      body: JSON.parse(request),
      signal: controller.signal,
    })
      .then(setPreview)
      .catch(() => undefined);
    return () => controller.abort();
  }, [request]);
  const recipients = locked ? (item?.recipients ?? 0) : (preview?.recipients ?? item?.recipients);

  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };
  const label = (path: string) => {
    const [name, code] = path.split(".");
    if (name === "audience") return t(`field.${code === "topics" ? "topics" : "locales"}`);
    const base = t(`field.${name as "subject"}`);
    return code ? forms("fieldIn", { field: base, language: languageName(code) }) : base;
  };

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    form.clear();
    setBusy("save");
    try {
      if (item) {
        const saved = await bff<Campaign>(`/newsletter/${item.id}`, { method: "PUT", body: draft });
        setItem(saved);
        setDirty(false);
        showToast(t("saved"));
      } else {
        const created = await bff<Campaign>("/newsletter", { method: "POST", body: draft });
        setDirty(false);
        showToast(t("created"));
        router.push(`/newsletter/${created.id}`);
      }
    } catch (error) {
      if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const sendAt = localToIso(at);
  const scheduling = Boolean(sendAt && Date.parse(sendAt) > Date.now());
  const send = async () => {
    if (!item) return;
    setBusy("send");
    try {
      const next = await bff<Campaign>(`/newsletter/${item.id}/send`, {
        method: "POST",
        body: scheduling ? { at: sendAt } : {},
      });
      setItem(next);
      setConfirming(false);
      showToast(
        next.status === "scheduled"
          ? t("scheduledToast")
          : t("sentToast", { count: next.recipients }),
      );
      focusField(form.fieldId("state"));
    } catch (error) {
      setConfirming(false);
      if (error instanceof BffError && error.type === "empty") showToast(t("noAudience"), "error");
      else if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };
  const unschedule = async () => {
    if (!item) return;
    setBusy("unschedule");
    try {
      setItem(await bff<Campaign>(`/newsletter/${item.id}/unschedule`, { method: "POST" }));
      showToast(t("unscheduledToast"));
      focusField(form.fieldId("state"));
    } catch {
      showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const moveItem = (index: number, by: -1 | 1) => {
    const next = [...draft.items];
    const [entry] = next.splice(index, 1);
    next.splice(index + by, 0, entry!);
    change({ items: next });
    setAnnouncement(
      t("moved", {
        title: titleOf(entry!),
        position: index + by + 1,
        count: next.length,
      }),
    );
    const target = index + by;
    const end = by === -1 ? target === 0 : target === next.length - 1;
    focusField(form.fieldId(`item-${target}-${(by === -1) !== end ? "up" : "down"}`));
  };
  const chosen = new Set(draft.items.map(keyOf));
  const groups = (["news", "publication"] as const).map((kind) => ({
    label: t(`kind.${kind}`),
    options: options.choices
      .filter((choice) => choice.kind === kind && !chosen.has(keyOf(choice)))
      .map((choice) => ({
        value: keyOf(choice),
        label: choice.title,
        description: formatDate(choice.date, locale, "medium"),
      })),
  }));

  const stamp = (value: string) =>
    forms("dateTime", {
      date: formatDate(value, locale, "medium"),
      time: formatTime(value, locale),
    });
  const share = (part: number, whole: number) =>
    formatNumber(whole > 0 ? part / whole : 0, locale, {
      style: "percent",
      maximumFractionDigits: 1,
    });
  const heading = item
    ? item.subject[locale] || item.subject[defaultLocale] || item.id
    : t("newTitle");
  const flagged = locales.filter((code) =>
    form.errors.some((error) => error.path.endsWith(`.${code}`)),
  );
  const subjectPath = `subject.${language}`;
  const introPath = `intro.${language}`;

  return (
    <div className="mt-2 flex flex-col gap-6">
      <div id={form.fieldId("state")} tabIndex={-1}>
        <h1 className="text-h1 break-words">{heading}</h1>
        {item && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusPill tone={CAMPAIGN_TONE[item.status]} label={t(`status.${item.status}`)} />
            {item.status === "scheduled" && item.sendAt && (
              <span className="text-sm">{t("scheduledFor", { when: stamp(item.sendAt) })}</span>
            )}
            {item.status === "sent" && item.sentAt && (
              <span className="text-sm">{t("sentOn", { when: stamp(item.sentAt) })}</span>
            )}
          </div>
        )}
      </div>

      {item?.status === "sent" && (
        <dl className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["recipients", formatNumber(item.recipients, locale)],
              ["openRate", share(item.opens, item.recipients)],
              ["clickRate", share(item.clicks, item.recipients)],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg border p-4">
              <dt className="text-muted-foreground text-sm">{t(`stat.${key}`)}</dt>
              <dd className="text-h2 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {item?.status === "scheduled" && (
        <div className="flex flex-wrap items-center gap-3">
          <p>{t("scheduledHelp")}</p>
          <Button variant="secondary" disabled={busy !== null} onClick={unschedule}>
            {busy === "unschedule" && (
              <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
            )}
            {t("unschedule")}
          </Button>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={save} noValidate className="flex min-w-0 flex-col gap-5">
          <ErrorSummary
            ref={form.summary}
            title={forms("errorTitle", { count: form.errors.length })}
            items={form.errors.map((error) => {
              const code = error.path.split(".")[1];
              return {
                href: `#${form.fieldId(error.path)}`,
                text: forms("errorLine", {
                  field: label(error.path),
                  message:
                    error.path === "items" && error.message === "required"
                      ? t("itemsRequired")
                      : forms(`error.${errorCode(error.message)}`),
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
          <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5">
            <legend className="sr-only">{t("content")}</legend>
            <div>
              <label htmlFor={form.fieldId(subjectPath)} className="mb-1 block font-semibold">
                {label(subjectPath)}
                {language === defaultLocale && (
                  <span className="text-muted-foreground ms-1 text-sm font-normal">
                    {forms("required")}
                  </span>
                )}
              </label>
              <input
                id={form.fieldId(subjectPath)}
                lang={language}
                className={FIELD}
                maxLength={120}
                value={draft.subject[language] ?? ""}
                aria-invalid={Boolean(form.errorFor(subjectPath))}
                aria-describedby={form.describedBy(subjectPath)}
                onChange={(event) =>
                  change({ subject: { ...draft.subject, [language]: event.target.value } })
                }
              />
              <FieldMessage
                id={`${form.fieldId(subjectPath)}-error`}
                text={errorText(subjectPath)}
              />
            </div>
            <div>
              <label htmlFor={form.fieldId(introPath)} className="mb-1 block font-semibold">
                {label(introPath)}
                <span className="text-muted-foreground ms-1 text-sm font-normal">
                  {forms("optional")}
                </span>
              </label>
              <textarea
                id={form.fieldId(introPath)}
                lang={language}
                className={AREA}
                value={draft.intro[language] ?? ""}
                onChange={(event) =>
                  change({ intro: { ...draft.intro, [language]: event.target.value } })
                }
              />
            </div>

            <fieldset id={form.fieldId("items")} tabIndex={-1} className="min-w-0">
              <legend className="font-semibold">
                {t("field.items")}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {t("itemLimit", { count: draft.items.length, max: MAX_CAMPAIGN_ITEMS })}
                </span>
              </legend>
              {draft.items.length === 0 && (
                <p className="text-muted-foreground mt-1">{t("noItems")}</p>
              )}
              <ol className="mt-2 flex flex-col gap-2">
                {draft.items.map((entry, index) => (
                  <li key={keyOf(entry)} className="flex items-center gap-1 rounded-md border ps-3">
                    <span className="min-w-0 flex-1 py-2">
                      <span className="block truncate">{titleOf(entry)}</span>
                      <span className="text-muted-foreground block text-xs">
                        {t(`kind.${entry.kind}`)}
                      </span>
                    </span>
                    {!locked && (
                      <>
                        <Button
                          id={form.fieldId(`item-${index}-up`)}
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === 0}
                          aria-label={t("moveUp", { title: titleOf(entry) })}
                          onClick={() => moveItem(index, -1)}
                        >
                          <ArrowUpIcon aria-hidden="true" />
                        </Button>
                        <Button
                          id={form.fieldId(`item-${index}-down`)}
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={index === draft.items.length - 1}
                          aria-label={t("moveDown", { title: titleOf(entry) })}
                          onClick={() => moveItem(index, 1)}
                        >
                          <ArrowDownIcon aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={t("removeItem", { title: titleOf(entry) })}
                          onClick={() => {
                            change({ items: draft.items.filter((_, i) => i !== index) });
                            focusField(form.fieldId("items"));
                          }}
                        >
                          <Trash2Icon aria-hidden="true" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              {!locked && draft.items.length < MAX_CAMPAIGN_ITEMS && (
                <div className="mt-3">
                  <Combobox
                    label={t("addItem")}
                    groups={groups}
                    value={null}
                    onChange={(value) => {
                      const choice = options.choices.find((entry) => keyOf(entry) === value);
                      if (choice)
                        change({
                          items: [...draft.items, { kind: choice.kind, slug: choice.slug }],
                        });
                    }}
                    clearLabel={t("clear")}
                    noResultsLabel={t("noChoice")}
                  />
                </div>
              )}
              <FieldMessage
                id={`${form.fieldId("items")}-error`}
                text={
                  form.errorFor("items")?.message === "required"
                    ? t("itemsRequired")
                    : errorText("items")
                }
              />
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <fieldset id={form.fieldId("audience.locales")} tabIndex={-1} className="min-w-0">
                <legend className="font-semibold">{t("field.locales")}</legend>
                <div className="mt-1 flex flex-col">
                  {locales.map((code) => (
                    <label key={code} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={draft.audience.locales.includes(code)}
                        onChange={(event) =>
                          change({
                            audience: {
                              ...draft.audience,
                              locales: toggle(draft.audience.locales, code, event.target.checked),
                            },
                          })
                        }
                      />
                      {languageName(code)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset id={form.fieldId("audience.topics")} tabIndex={-1} className="min-w-0">
                <legend className="font-semibold">{t("field.topics")}</legend>
                <div className="mt-1 flex flex-col">
                  {options.topics.map((topic) => (
                    <label key={topic.code} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={draft.audience.topics.includes(topic.code)}
                        onChange={(event) =>
                          change({
                            audience: {
                              ...draft.audience,
                              topics: toggle(
                                draft.audience.topics,
                                topic.code,
                                event.target.checked,
                              ),
                            },
                          })
                        }
                      />
                      {topic.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <p className="text-muted-foreground text-sm">{t("audienceHelp")}</p>
          </fieldset>
          <p role="status" className="font-semibold">
            {recipients === undefined ? "" : t("reach", { count: recipients })}
          </p>

          {!locked && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant={item ? "secondary" : "primary"}
                disabled={busy !== null}
              >
                {busy === "save" && (
                  <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
                )}
                {item ? t("saveDraft") : t("create")}
              </Button>
              <p role="status" className="text-muted-foreground text-sm">
                {dirty ? forms("unsaved") : ""}
              </p>
            </div>
          )}

          {item?.status === "draft" && (
            <section aria-labelledby={form.fieldId("sending")} className="rounded-lg border p-4">
              <h2 id={form.fieldId("sending")} className="text-h3">
                {t("sending")}
              </h2>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor={form.fieldId("at")} className="mb-1 block font-semibold">
                    {t("field.sendAt")}
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
                  type="button"
                  disabled={busy !== null}
                  aria-disabled={dirty || undefined}
                  aria-describedby={dirty ? `${form.fieldId("send")}-reason` : undefined}
                  className={dirty ? "cursor-not-allowed opacity-60" : undefined}
                  onClick={() => !dirty && setConfirming(true)}
                >
                  {scheduling ? t("schedule") : t("sendNow")}
                </Button>
              </div>
              <p id={`${form.fieldId("at")}-hint`} className="text-muted-foreground mt-2 text-sm">
                {t("hint.sendAt")}
              </p>
              {dirty && (
                <p id={`${form.fieldId("send")}-reason`} className="mt-2 text-sm">
                  {forms("saveFirst")}
                </p>
              )}
            </section>
          )}
        </form>

        <section aria-labelledby={form.fieldId("preview")} className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={form.fieldId("preview")} className="text-h3">
              {t("preview")}
            </h2>
            <div role="group" aria-label={t("previewWidth")} className="flex gap-2">
              {(["desktop", "mobile"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={device === key}
                  onClick={() => setDevice(key)}
                  className={cn(
                    "min-h-11 rounded-md border px-4 font-semibold",
                    device === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background",
                  )}
                >
                  {t(`device.${key}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("previewIn", { language: languageName(language) })}
          </p>
          <p className="mt-2 break-words">
            <span className="font-semibold">{t("subjectLine")}</span>{" "}
            <span lang={language}>{preview?.subject || t("noSubject")}</span>
          </p>
          <div className="bg-surface-2 mt-3 overflow-x-auto rounded-lg border p-3">
            {/* No scripts and no same-origin access: the email is only shown. */}
            <iframe
              title={t("previewTitle")}
              sandbox=""
              srcDoc={preview?.html ?? ""}
              className={cn(
                "bg-background mx-auto block h-144 border",
                device === "desktop" ? "w-full max-w-160" : "w-90 max-w-full",
              )}
            />
          </div>
        </section>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={
          scheduling && sendAt
            ? t("confirmSchedule", { when: stamp(sendAt) })
            : t("confirmSend", { count: recipients ?? 0 })
        }
        description={
          scheduling ? t("confirmScheduleHelp", { count: recipients ?? 0 }) : t("confirmSendHelp")
        }
        confirm={scheduling ? t("schedule") : t("sendNow")}
        pending={busy === "send"}
        onConfirm={send}
      />
    </div>
  );
}
