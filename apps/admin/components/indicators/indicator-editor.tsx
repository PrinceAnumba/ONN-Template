"use client";

import type { IndicatorAdmin, IndicatorRecord, Localised } from "@onn/api-client/types";
import { Markdown } from "@onn/ui/components/markdown";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@onn/ui/components/ui/dialog";
import { useRestoreFocus } from "@onn/ui/lib/use-restore-focus";
import { cn } from "@onn/ui/lib/utils";
import { tagFor } from "@onn/config/locale";
import { LoaderCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { bff, BffError } from "@/lib/bff";
import { formatDate, formatNumber } from "@/lib/format";
import {
  DIMENSIONS,
  EDITOR_TABS,
  INDICATOR_STATUSES,
  INTL_ORGS,
  PERIODICITIES,
  PRIORITY_KEYS,
  tabOfPath,
  type EditorTab,
} from "@/lib/indicators";

const FIELD = "border-input bg-background h-11 w-full rounded-md border px-3";
const AREA = "border-input bg-background min-h-32 w-full rounded-md border p-3";
type FieldError = { path: string; message: string };

export interface EditorPillar {
  code: string;
  name: string;
  themes: { code: string; name: string }[];
}

interface IndicatorEditorProps {
  initial: IndicatorAdmin;
  pillars: EditorPillar[];
  orgs: { code: string; name: string }[];
  locales: string[];
  defaultLocale: string;
  /** "national" and the configured boundary levels, with their labels. */
  geoLevels: { key: string; label: string }[];
  canEdit: boolean;
  initialTab: EditorTab;
}

/** The editable part of an indicator: everything but its version bookkeeping. */
const recordOf = (item: IndicatorAdmin): IndicatorRecord => {
  const record: Partial<IndicatorAdmin> = structuredClone(item);
  delete record.version;
  delete record.updated;
  delete record.versions;
  return record as IndicatorRecord;
};

/** The referential editor (brief §7): eleven tabs, one draft, saved as a new version. */
export function IndicatorEditor({
  initial,
  pillars,
  orgs,
  locales,
  defaultLocale,
  geoLevels,
  canEdit,
  initialTab,
}: IndicatorEditorProps) {
  const t = useTranslations("Admin.indicators");
  const common = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const saved = useMemo(() => recordOf(initial), [initial]);
  const [draft, setDraft] = useState<IndicatorRecord>(saved);
  const [tab, setTab] = useState<EditorTab>(initialTab);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [definitionLocale, setDefinitionLocale] = useState(defaultLocale);
  const restoreFocus = useRestoreFocus(open);
  const summary = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<EditorTab, HTMLButtonElement | null>>>({});

  useEffect(() => setDraft(saved), [saved]);

  const changed = useMemo(
    () =>
      (Object.keys(draft) as (keyof IndicatorRecord)[]).filter(
        (key) => JSON.stringify(draft[key]) !== JSON.stringify(saved[key]),
      ),
    [draft, saved],
  );
  const dirty = changed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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

  const select = (next: EditorTab, focus = false) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "general") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
    if (focus) tabRefs.current[next]?.focus();
  };
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = EDITOR_TABS.indexOf(tab);
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const step =
      event.key === "ArrowRight" ? (rtl ? -1 : 1) : event.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    if (step) {
      event.preventDefault();
      select(EDITOR_TABS[(index + step + EDITOR_TABS.length) % EDITOR_TABS.length]!, true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      select(EDITOR_TABS[event.key === "Home" ? 0 : EDITOR_TABS.length - 1]!, true);
    }
  };

  const update = (change: Partial<IndicatorRecord>) =>
    setDraft((current) => ({ ...current, ...change }));
  const fieldId = (path: string) => `${id}-${path.replace(/\W/g, "-")}`;
  const errorFor = (path: string) => errors.find((error) => error.path === path);
  const errorText = (error: FieldError) =>
    t(
      `error.${["required", "format", "order", "range", "duplicate", "unknown"].includes(error.message) ? error.message : "format"}`,
    );
  const fieldLabel = (path: string) => {
    const [key, second, third] = path.split(".");
    if (key === "name" || key === "shortDefinition" || key === "unit") {
      return t("fieldIn", {
        field: t(`field.${key}`),
        language: languageName(second ?? defaultLocale),
      });
    }
    if (key === "unitVariants" || key === "intlRefs") {
      const row = Number(second ?? 0) + 1;
      return third
        ? t("fieldRowPart", { field: t(`field.${key}`), row, part: t(`part.${third}`) })
        : t("fieldRow", { field: t(`field.${key}`), row });
    }
    if (second && (key === "thresholds" || key === "goalposts" || key === "priority")) {
      return t(`field.${key}_${second}`);
    }
    return t(`field.${key}`);
  };
  const tabErrors = (target: EditorTab) =>
    errors.filter((error) => tabOfPath(error.path) === target).length;
  const tabChanged = (target: EditorTab) => changed.some((key) => tabOfPath(key) === target);

  const goTo = (path: string) => {
    select(tabOfPath(path));
    requestAnimationFrame(() => {
      const element =
        document.getElementById(fieldId(path)) ??
        document.getElementById(fieldId(path.split(".")[0] ?? path));
      element?.focus();
    });
  };

  const openSave = () => {
    if (!dirty) return;
    setNoteError(false);
    setOpen(true);
  };

  const save = async () => {
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    setSaving(true);
    try {
      const result = await bff<IndicatorAdmin>(`/indicators/${encodeURIComponent(initial.code)}`, {
        method: "PUT",
        body: { indicator: draft, note },
      });
      setOpen(false);
      setNote("");
      setErrors([]);
      showToast(t("saved", { version: result.version }));
      router.refresh();
    } catch (error) {
      if (error instanceof BffError && error.type === "unchanged") {
        setOpen(false);
        showToast(t("unchanged"));
      } else if (error instanceof BffError && error.status === 422) {
        const fields = error.errors.filter((item) => item.path !== "note");
        if (!fields.length) {
          setNoteError(true);
        } else {
          setOpen(false);
          setErrors(fields);
          select(tabOfPath(fields[0]!.path));
          requestAnimationFrame(() => summary.current?.focus());
        }
      } else {
        showToast(t("saveFailed"), "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // ---- Field helpers ----

  const describedBy = (path: string, hint?: string) =>
    [hint, errorFor(path) ? `${fieldId(path)}-error` : undefined].filter(Boolean).join(" ") ||
    undefined;
  const ErrorLine = ({ path }: { path: string }) => {
    const error = errorFor(path);
    return error ? (
      <p id={`${fieldId(path)}-error`} className="text-destructive mt-1 text-sm">
        {errorText(error)}
      </p>
    ) : null;
  };
  const Label = ({
    path,
    children,
    required,
  }: {
    path: string;
    children: React.ReactNode;
    required?: boolean;
  }) => (
    <label htmlFor={fieldId(path)} className="mb-1 block font-semibold">
      {children}
      {required && (
        <span className="text-muted-foreground ms-1 text-sm font-normal">
          {t("requiredSuffix")}
        </span>
      )}
    </label>
  );

  /** One input per enabled locale, side by side (brief §7 "names per locale side by side"). */
  const localised = (key: "name" | "shortDefinition" | "unit", multiline = false) => (
    <fieldset className="md:col-span-2">
      <legend className="text-h4">{t(`field.${key}`)}</legend>
      <div className={cn("mt-2 grid gap-4", locales.length > 1 && "md:grid-cols-2 xl:grid-cols-3")}>
        {locales.map((code) => {
          const path = `${key}.${code}`;
          const value = (draft[key] as Localised)[code] ?? "";
          const props = {
            id: fieldId(path),
            lang: code,
            value,
            "aria-invalid": Boolean(errorFor(path)),
            "aria-describedby": describedBy(path),
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              update({ [key]: { ...(draft[key] as Localised), [code]: event.target.value } }),
          };
          return (
            <div key={code}>
              <Label path={path} required={code === defaultLocale}>
                {languageName(code)}
              </Label>
              {multiline ? (
                <textarea {...props} className={cn(AREA, "min-h-24")} />
              ) : (
                <input {...props} className={FIELD} />
              )}
              <ErrorLine path={path} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );

  const numberInput = (
    path: string,
    value: number | null,
    onChange: (value: number | null) => void,
    hint?: string,
  ) => (
    <div>
      <Label path={path}>{fieldLabel(path)}</Label>
      <input
        id={fieldId(path)}
        type="number"
        inputMode="decimal"
        step="any"
        className={FIELD}
        value={value ?? ""}
        aria-invalid={Boolean(errorFor(path))}
        aria-describedby={describedBy(path, hint ? `${fieldId(path)}-hint` : undefined)}
        onChange={(event) =>
          onChange(Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber)
        }
      />
      {hint && (
        <p id={`${fieldId(path)}-hint`} className="text-muted-foreground mt-1 text-sm">
          {hint}
        </p>
      )}
      <ErrorLine path={path} />
    </div>
  );

  const checkboxes = (
    key: "disaggregations" | "geoLevels",
    options: { key: string; label: string }[],
  ) => (
    <fieldset
      id={fieldId(key)}
      tabIndex={-1}
      aria-describedby={describedBy(key, `${fieldId(key)}-hint`)}
    >
      <legend className="text-h4">{t(`field.${key}`)}</legend>
      <p id={`${fieldId(key)}-hint`} className="text-muted-foreground mt-1">
        {t(`hint.${key}`)}
      </p>
      <ul className="mt-3 flex flex-col gap-1">
        {options.map((option) => {
          const checked = draft[key].includes(option.key);
          return (
            <li key={option.key}>
              <label className="inline-flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={checked}
                  onChange={() =>
                    update({
                      [key]: checked
                        ? draft[key].filter((item) => item !== option.key)
                        : [...draft[key], option.key],
                    })
                  }
                />
                {option.label}
              </label>
            </li>
          );
        })}
      </ul>
      <ErrorLine path={key} />
    </fieldset>
  );

  const pillar = pillars.find((item) => item.code === draft.pillar);
  const score =
    PRIORITY_KEYS.reduce((sum, key) => sum + draft.priority[key], 0) / PRIORITY_KEYS.length;

  const panels: Record<EditorTab, React.ReactNode> = {
    general: (
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-1 font-semibold">{t("field.code")}</p>
          <p className="font-mono text-lg">{draft.code}</p>
        </div>
        <div>
          <Label path="status">{t("field.status")}</Label>
          <select
            id={fieldId("status")}
            className={FIELD}
            value={draft.status}
            onChange={(event) =>
              update({ status: event.target.value as IndicatorRecord["status"] })
            }
          >
            {INDICATOR_STATUSES.map((item) => (
              <option key={item} value={item}>
                {t(`status.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label path="pillar">{t("field.pillar")}</Label>
          <select
            id={fieldId("pillar")}
            className={FIELD}
            value={draft.pillar}
            aria-describedby={describedBy("pillar")}
            onChange={(event) => {
              const next = pillars.find((item) => item.code === event.target.value);
              update({ pillar: event.target.value, theme: next?.themes[0]?.code ?? "" });
            }}
          >
            {pillars.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
          <ErrorLine path="pillar" />
        </div>
        <div>
          <Label path="theme">{t("field.theme")}</Label>
          <select
            id={fieldId("theme")}
            className={FIELD}
            value={draft.theme}
            aria-describedby={describedBy("theme")}
            onChange={(event) => update({ theme: event.target.value })}
          >
            {(pillar?.themes ?? []).map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
          <ErrorLine path="theme" />
        </div>
        <div>
          <Label path="org">{t("field.org")}</Label>
          <select
            id={fieldId("org")}
            className={FIELD}
            value={draft.org}
            onChange={(event) => update({ org: event.target.value })}
          >
            {orgs.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label path="licence">{t("field.licence")}</Label>
          <input
            id={fieldId("licence")}
            className={FIELD}
            value={draft.licence}
            aria-invalid={Boolean(errorFor("licence"))}
            aria-describedby={describedBy("licence")}
            onChange={(event) => update({ licence: event.target.value })}
          />
          <ErrorLine path="licence" />
        </div>
        <label className="inline-flex min-h-11 items-center gap-3 md:col-span-2">
          <input
            type="checkbox"
            className="size-5"
            checked={draft.isHeadline}
            onChange={(event) => update({ isHeadline: event.target.checked })}
          />
          {t("field.isHeadline")}
        </label>
        {localised("name")}
        {localised("shortDefinition", true)}
        <div className="md:col-span-2">
          <Label path="synonyms">{t("field.synonyms")}</Label>
          <textarea
            id={fieldId("synonyms")}
            className={cn(AREA, "min-h-24")}
            value={draft.synonyms.join("\n")}
            aria-describedby={`${fieldId("synonyms")}-hint`}
            onChange={(event) => update({ synonyms: event.target.value.split("\n") })}
          />
          <p id={`${fieldId("synonyms")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {t("hint.synonyms")}
          </p>
        </div>
      </div>
    ),

    definition: (
      <div>
        <p className="text-muted-foreground">{t("hint.markdown")}</p>
        {(["definition", "computation", "qualityNotes"] as const).map((key) => {
          const path = `${key}.${definitionLocale}`;
          const value = draft[key][definitionLocale] ?? "";
          return (
            <div key={key} className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <label htmlFor={fieldId(path)} className="mb-1 block font-semibold">
                  {t("fieldIn", {
                    field: t(`field.${key}`),
                    language: languageName(definitionLocale),
                  })}
                </label>
                <textarea
                  id={fieldId(path)}
                  lang={definitionLocale}
                  className={cn(AREA, "min-h-48 font-mono text-sm")}
                  value={value}
                  onChange={(event) =>
                    update({ [key]: { ...draft[key], [definitionLocale]: event.target.value } })
                  }
                />
              </div>
              <div>
                <p className="mb-1 font-semibold">{t("preview")}</p>
                <div lang={definitionLocale} className="bg-surface-2 min-h-48 rounded-md p-3">
                  {value.trim() ? (
                    <Markdown source={value} />
                  ) : (
                    <p className="text-muted-foreground">{t("previewEmpty")}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    ),

    units: (
      <div className="flex flex-col gap-6">
        {localised("unit")}
        <label className="inline-flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5"
            checked={draft.higherIsBetter}
            onChange={(event) => update({ higherIsBetter: event.target.checked })}
          />
          {t("field.higherIsBetter")}
        </label>
        <fieldset id={fieldId("unitVariants")} tabIndex={-1}>
          <legend className="text-h4">{t("field.unitVariants")}</legend>
          <p className="text-muted-foreground mt-1">{t("hint.unitVariants")}</p>
          <ErrorLine path="unitVariants" />
          <ol className="mt-3 flex flex-col gap-4">
            {draft.unitVariants.map((variant, index) => {
              const setVariant = (change: Partial<typeof variant>) =>
                update({
                  unitVariants: draft.unitVariants.map((item, position) =>
                    position === index ? { ...item, ...change } : item,
                  ),
                });
              const codePath = `unitVariants.${index}.code`;
              return (
                <li key={index} className="rounded-md border p-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div>
                      <Label path={codePath} required>
                        {t("part.code")}
                      </Label>
                      <input
                        id={fieldId(codePath)}
                        className={cn(FIELD, "font-mono")}
                        value={variant.code}
                        aria-invalid={Boolean(errorFor(codePath))}
                        aria-describedby={describedBy(codePath)}
                        onChange={(event) => setVariant({ code: event.target.value })}
                      />
                      <ErrorLine path={codePath} />
                    </div>
                    {locales.map((code) => {
                      const path = `unitVariants.${index}.label.${code}`;
                      return (
                        <div key={code}>
                          <Label path={path} required={code === defaultLocale}>
                            {t("labelIn", { language: languageName(code) })}
                          </Label>
                          <input
                            id={fieldId(path)}
                            lang={code}
                            className={FIELD}
                            value={variant.label[code] ?? ""}
                            aria-invalid={Boolean(errorFor(path))}
                            aria-describedby={describedBy(path)}
                            onChange={(event) =>
                              setVariant({
                                label: { ...variant.label, [code]: event.target.value },
                              })
                            }
                          />
                          <ErrorLine path={path} />
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      update({
                        unitVariants: draft.unitVariants.filter(
                          (_, position) => position !== index,
                        ),
                      })
                    }
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    {t("removeVariant", { code: variant.code || index + 1 })}
                  </Button>
                </li>
              );
            })}
          </ol>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() =>
              update({ unitVariants: [...draft.unitVariants, { code: "", label: {} }] })
            }
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            {t("addVariant")}
          </Button>
        </fieldset>
      </div>
    ),

    dimensions: checkboxes(
      "disaggregations",
      DIMENSIONS.map((key) => ({ key, label: t(`dimension.${key}`) })),
    ),

    geography: checkboxes("geoLevels", geoLevels),

    thresholds: (
      <div>
        <p className="text-muted-foreground max-w-2xl">{t("hint.thresholds")}</p>
        <div className="mt-4 grid max-w-3xl gap-4 md:grid-cols-3">
          {numberInput("thresholds.min", draft.thresholds.min, (min) =>
            update({ thresholds: { ...draft.thresholds, min } }),
          )}
          {numberInput("thresholds.max", draft.thresholds.max, (max) =>
            update({ thresholds: { ...draft.thresholds, max } }),
          )}
          {numberInput(
            "thresholds.jumpPct",
            draft.thresholds.jumpPct,
            (jumpPct) => update({ thresholds: { ...draft.thresholds, jumpPct: jumpPct ?? 0 } }),
            t("hint.jumpPct"),
          )}
        </div>
      </div>
    ),

    goalposts: (
      <div>
        <p className="text-muted-foreground max-w-2xl">{t("hint.goalposts")}</p>
        <div className="mt-4 grid max-w-3xl gap-4 md:grid-cols-2">
          {numberInput("goalposts.min", draft.goalposts.min, (min) =>
            update({ goalposts: { ...draft.goalposts, min } }),
          )}
          {numberInput("goalposts.max", draft.goalposts.max, (max) =>
            update({ goalposts: { ...draft.goalposts, max } }),
          )}
          {numberInput("goalposts.target", draft.goalposts.target, (target) =>
            update({ goalposts: { ...draft.goalposts, target } }),
          )}
          <div>
            <Label path="goalposts.targetYear">{t("field.goalposts_targetYear")}</Label>
            <input
              id={fieldId("goalposts.targetYear")}
              inputMode="numeric"
              maxLength={4}
              className={FIELD}
              value={draft.goalposts.targetYear ?? ""}
              aria-invalid={Boolean(errorFor("goalposts.targetYear"))}
              aria-describedby={describedBy("goalposts.targetYear")}
              onChange={(event) =>
                update({
                  goalposts: { ...draft.goalposts, targetYear: event.target.value.trim() || null },
                })
              }
            />
            <ErrorLine path="goalposts.targetYear" />
          </div>
        </div>
      </div>
    ),

    references: (
      <fieldset id={fieldId("intlRefs")} tabIndex={-1}>
        <legend className="text-h4">{t("field.intlRefs")}</legend>
        <p className="text-muted-foreground mt-1">{t("hint.intlRefs")}</p>
        {draft.intlRefs.length === 0 && <p className="mt-3">{t("noRefs")}</p>}
        <ol className="mt-3 flex flex-col gap-4">
          {draft.intlRefs.map((ref, index) => {
            const setRef = (change: Partial<typeof ref>) =>
              update({
                intlRefs: draft.intlRefs.map((item, position) =>
                  position === index ? { ...item, ...change } : item,
                ),
              });
            const path = (part: string) => `intlRefs.${index}.${part}`;
            return (
              <li key={index} className="rounded-md border p-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label path={path("org")}>{t("part.org")}</Label>
                    <select
                      id={fieldId(path("org"))}
                      className={FIELD}
                      value={ref.org}
                      onChange={(event) =>
                        setRef({ org: event.target.value as (typeof INTL_ORGS)[number] })
                      }
                    >
                      {INTL_ORGS.map((org) => (
                        <option key={org} value={org}>
                          {t(`intlOrg.${org}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label path={path("code")} required>
                      {t("part.code")}
                    </Label>
                    <input
                      id={fieldId(path("code"))}
                      className={cn(FIELD, "font-mono")}
                      value={ref.code}
                      aria-invalid={Boolean(errorFor(path("code")))}
                      aria-describedby={describedBy(path("code"))}
                      onChange={(event) => setRef({ code: event.target.value })}
                    />
                    <ErrorLine path={path("code")} />
                  </div>
                  <div>
                    <Label path={path("url")} required>
                      {t("part.url")}
                    </Label>
                    <input
                      id={fieldId(path("url"))}
                      type="url"
                      className={FIELD}
                      value={ref.url}
                      aria-invalid={Boolean(errorFor(path("url")))}
                      aria-describedby={describedBy(path("url"))}
                      onChange={(event) => setRef({ url: event.target.value })}
                    />
                    <ErrorLine path={path("url")} />
                  </div>
                  {locales.map((code) => (
                    <div key={code}>
                      <Label path={path(`name.${code}`)}>
                        {t("nameIn", { language: languageName(code) })}
                      </Label>
                      <input
                        id={fieldId(path(`name.${code}`))}
                        lang={code}
                        className={FIELD}
                        value={ref.name[code] ?? ""}
                        onChange={(event) =>
                          setRef({ name: { ...ref.name, [code]: event.target.value } })
                        }
                      />
                    </div>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    update({ intlRefs: draft.intlRefs.filter((_, position) => position !== index) })
                  }
                >
                  <Trash2Icon aria-hidden="true" className="size-4" />
                  {t("removeRef", { code: ref.code || index + 1 })}
                </Button>
              </li>
            );
          })}
        </ol>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() =>
            update({ intlRefs: [...draft.intlRefs, { org: "ITU", code: "", name: {}, url: "" }] })
          }
        >
          <PlusIcon aria-hidden="true" className="size-4" />
          {t("addRef")}
        </Button>
      </fieldset>
    ),

    calendar: (
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <div>
          <Label path="periodicity">{t("field.periodicity")}</Label>
          <select
            id={fieldId("periodicity")}
            className={FIELD}
            value={draft.periodicity}
            onChange={(event) =>
              update({ periodicity: event.target.value as IndicatorRecord["periodicity"] })
            }
          >
            {PERIODICITIES.map((item) => (
              <option key={item} value={item}>
                {t(`periodicity.${item}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label path="nextRelease">{t("field.nextRelease")}</Label>
          <input
            id={fieldId("nextRelease")}
            type="month"
            className={FIELD}
            value={draft.nextRelease ?? ""}
            aria-invalid={Boolean(errorFor("nextRelease"))}
            aria-describedby={describedBy("nextRelease", `${fieldId("nextRelease")}-hint`)}
            onChange={(event) => update({ nextRelease: event.target.value || null })}
          />
          <p id={`${fieldId("nextRelease")}-hint`} className="text-muted-foreground mt-1 text-sm">
            {t("hint.nextRelease")}
          </p>
          <ErrorLine path="nextRelease" />
        </div>
      </div>
    ),

    priority: (
      <div className="max-w-2xl">
        <p className="text-muted-foreground">{t("hint.priority")}</p>
        <div className="mt-4 flex flex-col gap-5">
          {PRIORITY_KEYS.map((key) => {
            const path = `priority.${key}`;
            return (
              <div key={key}>
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor={fieldId(path)} className="font-semibold">
                    {t(`field.priority_${key}`)}
                  </label>
                  <output htmlFor={fieldId(path)} className="text-h4 tabular-nums">
                    {formatNumber(draft.priority[key], locale)}
                  </output>
                </div>
                <input
                  id={fieldId(path)}
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  className="accent-primary mt-2 h-11 w-full"
                  value={draft.priority[key]}
                  aria-describedby={`${fieldId(path)}-hint`}
                  onChange={(event) =>
                    update({ priority: { ...draft.priority, [key]: Number(event.target.value) } })
                  }
                />
                <p id={`${fieldId(path)}-hint`} className="text-muted-foreground text-sm">
                  {t(`hint.priority_${key}`)}
                </p>
                <ErrorLine path={path} />
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-lg">
          {t("score", {
            score: formatNumber(score, locale, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            }),
          })}
        </p>
      </div>
    ),

    versions: (
      <ol className="flex flex-col gap-3">
        {initial.versions.map((version) => (
          <li key={version.version} className="rounded-md border p-3">
            <p className="font-semibold">
              {t("versionLine", {
                version: version.version,
                date: formatDate(version.date, locale, "medium"),
                author: version.author.name,
              })}
            </p>
            {version.note && <p className="mt-1">{version.note}</p>}
            {version.changes.length > 0 && (
              <p className="text-muted-foreground mt-1 text-sm">
                {t("versionChanges", {
                  fields: new Intl.ListFormat(tagFor(locale), { type: "conjunction" }).format(
                    version.changes.map((key) => t(`field.${key}`)),
                  ),
                })}
              </p>
            )}
          </li>
        ))}
      </ol>
    ),
  };

  return (
    <div className="mt-6">
      {!canEdit && <p className="bg-surface-2 mb-6 max-w-3xl rounded-md p-3">{t("readOnly")}</p>}
      {errors.length > 0 && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          aria-labelledby={`${id}-summary`}
          className="border-destructive mb-6 max-w-3xl rounded-lg border-2 p-4"
        >
          <h2 id={`${id}-summary`} className="text-h4">
            {t("errorTitle", { count: errors.length })}
          </h2>
          <ul className="mt-2 list-disc ps-5">
            {errors.map((error) => (
              <li key={`${error.path}-${error.message}`}>
                <a
                  href={`#${fieldId(error.path)}`}
                  className="underline"
                  onClick={(event) => {
                    event.preventDefault();
                    goTo(error.path);
                  }}
                >
                  {t("errorLine", {
                    tab: t(`tab.${tabOfPath(error.path)}`),
                    field: fieldLabel(error.path),
                    message: errorText(error),
                  })}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && (
        <div className="bg-background sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <Button
            onClick={openSave}
            aria-disabled={!dirty || undefined}
            aria-describedby={`${id}-state`}
          >
            {t("saveVersion")}
          </Button>
          <p id={`${id}-state`} className="text-muted-foreground text-sm" aria-live="polite">
            {dirty ? t("unsaved", { count: changed.length }) : t("noChanges")}
          </p>
          {dirty && (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft(saved);
                setErrors([]);
              }}
            >
              {t("discard")}
            </Button>
          )}
        </div>
      )}

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="flex gap-1 overflow-x-auto border-b"
      >
        {EDITOR_TABS.map((item) => {
          const count = tabErrors(item);
          return (
            <button
              key={item}
              ref={(element) => {
                tabRefs.current[item] = element;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${item}`}
              aria-selected={tab === item}
              aria-controls={`${id}-panel`}
              tabIndex={tab === item ? 0 : -1}
              onClick={() => select(item)}
              onKeyDown={onTabKey}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 font-semibold whitespace-nowrap",
                tab === item
                  ? "border-primary text-foreground"
                  : "text-muted-foreground border-transparent",
              )}
            >
              {t(`tab.${item}`)}
              {tabChanged(item) && (
                <span className="bg-primary size-2 rounded-full" aria-hidden="true" />
              )}
              {tabChanged(item) && <span className="sr-only">{t("tabChanged")}</span>}
              {count > 0 && (
                <span className="bg-destructive text-primary-foreground rounded-pill px-2 text-xs">
                  {formatNumber(count, locale)}
                  <span className="sr-only">{t("tabErrors", { count })}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${tab}`}
        tabIndex={0}
        className="py-6"
      >
        <h2 className="sr-only">{t(`tab.${tab}`)}</h2>
        {tab === "definition" && (
          <div className="mb-3">
            <div role="group" aria-label={t("languageGroup")} className="flex flex-wrap gap-2">
              {locales.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={definitionLocale === code}
                  onClick={() => setDefinitionLocale(code)}
                  className={cn(
                    "min-h-11 rounded-md border px-4 font-semibold",
                    definitionLocale === code
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background",
                  )}
                >
                  {languageName(code)}
                </button>
              ))}
            </div>
          </div>
        )}
        <fieldset disabled={!canEdit} className="min-w-0">
          <legend className="sr-only">{t(`tab.${tab}`)}</legend>
          {panels[tab]}
        </fieldset>
      </div>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent closeLabel={common("close")} onCloseAutoFocus={restoreFocus}>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("saveTitle", { version: initial.version + 1 })}</DialogTitle>
              <DialogDescription>
                {t("saveDescription", {
                  fields: new Intl.ListFormat(tagFor(locale), { type: "conjunction" }).format(
                    changed.map((key) => t(`field.${key}`)),
                  ),
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="my-4">
              <label htmlFor={`${id}-note`} className="mb-1 block font-semibold">
                {t("noteLabel")}
              </label>
              <textarea
                id={`${id}-note`}
                className={cn(AREA, "min-h-24")}
                value={note}
                maxLength={500}
                required
                aria-invalid={noteError}
                aria-describedby={noteError ? `${id}-note-error` : `${id}-note-hint`}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (event.target.value.trim()) setNoteError(false);
                }}
              />
              {noteError ? (
                <p id={`${id}-note-error`} className="text-destructive mt-1 text-sm">
                  {t("noteRequired")}
                </p>
              ) : (
                <p id={`${id}-note-hint`} className="text-muted-foreground mt-1 text-sm">
                  {t("noteHint")}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
                {t("saveConfirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
