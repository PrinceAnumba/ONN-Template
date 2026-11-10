"use client";

import type { WatchSettings } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import {
  AREA,
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  focusField,
  useFormErrors,
} from "@/components/forms/form-errors";
import { bff } from "@/lib/bff";
import { splitList } from "@/lib/editorial";

type Source = WatchSettings["sources"][number] & { key: number };

/** What the collector looks for and where (brief §7 "keyword and source settings"). */
export function WatchSettingsForm({ initial }: { initial: WatchSettings }) {
  const t = useTranslations("Admin.news.watch.settings");
  const forms = useTranslations("Admin.forms");
  const form = useFormErrors();
  const nextKey = useRef(initial.sources.length);
  const [keywords, setKeywords] = useState(initial.keywords.join("\n"));
  const [sources, setSources] = useState<Source[]>(
    initial.sources.map((source, key) => ({ ...source, key })),
  );
  const [busy, setBusy] = useState(false);

  const update = (key: number, patch: Partial<Source>) =>
    setSources((current) =>
      current.map((source) => (source.key === key ? { ...source, ...patch } : source)),
    );
  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };
  const label = (path: string) => {
    const [, index, field] = path.split(".");
    return index === undefined
      ? t("keywords")
      : t("sourceField", { field: t(`source.${field as "name"}`), number: Number(index) + 1 });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    form.clear();
    setBusy(true);
    try {
      const saved = await bff<WatchSettings>("/news-watch/settings", {
        method: "PUT",
        body: {
          keywords: splitList(keywords),
          sources: sources.map(({ name, url, enabled }) => ({ name, url, enabled })),
        },
      });
      setKeywords(saved.keywords.join("\n"));
      showToast(t("saved"));
    } catch (error) {
      if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <ErrorSummary
        ref={form.summary}
        title={forms("errorTitle", { count: form.errors.length })}
        items={form.errors.map((error) => ({
          href: `#${form.fieldId(error.path)}`,
          text: forms("errorLine", {
            field: label(error.path),
            message: forms(`error.${errorCode(error.message)}`),
          }),
        }))}
      />
      <div className="max-w-xl">
        <label htmlFor={form.fieldId("keywords")} className="mb-1 block font-semibold">
          {t("keywords")}
        </label>
        <textarea
          id={form.fieldId("keywords")}
          className={`${AREA} min-h-36`}
          value={keywords}
          aria-invalid={Boolean(form.errorFor("keywords"))}
          aria-describedby={form.describedBy("keywords", `${form.fieldId("keywords")}-hint`)}
          onChange={(event) => setKeywords(event.target.value)}
        />
        <p id={`${form.fieldId("keywords")}-hint`} className="text-muted-foreground mt-1 text-sm">
          {t("keywordsHint")}
        </p>
        <FieldMessage id={`${form.fieldId("keywords")}-error`} text={errorText("keywords")} />
      </div>

      <fieldset>
        <legend className="text-h4">{t("sources")}</legend>
        {sources.length === 0 && <p className="text-muted-foreground mt-2">{t("noSources")}</p>}
        <ul className="mt-2 flex flex-col gap-3">
          {sources.map((source, index) => {
            const namePath = `sources.${index}.name`;
            const urlPath = `sources.${index}.url`;
            return (
              <li key={source.key}>
                <fieldset className="grid items-start gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto_auto]">
                  <legend className="sr-only">{t("sourceN", { number: index + 1 })}</legend>
                  <div>
                    <label htmlFor={form.fieldId(namePath)} className="mb-1 block font-semibold">
                      {t("source.name")}
                    </label>
                    <input
                      id={form.fieldId(namePath)}
                      className={FIELD}
                      value={source.name}
                      aria-invalid={Boolean(form.errorFor(namePath))}
                      aria-describedby={form.describedBy(namePath)}
                      onChange={(event) => update(source.key, { name: event.target.value })}
                    />
                    <FieldMessage
                      id={`${form.fieldId(namePath)}-error`}
                      text={errorText(namePath)}
                    />
                  </div>
                  <div>
                    <label htmlFor={form.fieldId(urlPath)} className="mb-1 block font-semibold">
                      {t("source.url")}
                    </label>
                    <input
                      id={form.fieldId(urlPath)}
                      type="url"
                      inputMode="url"
                      className={FIELD}
                      value={source.url}
                      aria-invalid={Boolean(form.errorFor(urlPath))}
                      aria-describedby={form.describedBy(urlPath)}
                      onChange={(event) => update(source.key, { url: event.target.value })}
                    />
                    <FieldMessage id={`${form.fieldId(urlPath)}-error`} text={errorText(urlPath)} />
                  </div>
                  <label className="flex min-h-11 items-center gap-2 md:mt-7">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={source.enabled}
                      onChange={(event) => update(source.key, { enabled: event.target.checked })}
                    />
                    {t("source.enabled")}
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:mt-7"
                    aria-label={t("removeSource", {
                      name: source.name || t("sourceN", { number: index + 1 }),
                    })}
                    onClick={() => {
                      setSources((current) => current.filter((item) => item.key !== source.key));
                      focusField(form.fieldId("add"));
                    }}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </fieldset>
              </li>
            );
          })}
        </ul>
        <Button
          id={form.fieldId("add")}
          type="button"
          variant="secondary"
          className="mt-3"
          onClick={() => {
            const index = sources.length;
            setSources([...sources, { name: "", url: "", enabled: true, key: nextKey.current++ }]);
            focusField(form.fieldId(`sources.${index}.name`));
          }}
        >
          <PlusIcon aria-hidden="true" />
          {t("addSource")}
        </Button>
      </fieldset>
      <div>
        <Button type="submit" disabled={busy}>
          {busy && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
          {forms("save")}
        </Button>
      </div>
    </form>
  );
}
