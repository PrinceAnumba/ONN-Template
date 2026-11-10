"use client";

import type { HomeModules, HomeModulesAdmin } from "@onn/api-client/types";
import { Button } from "@onn/ui/components/ui/button";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { DraftBar, useDraftPublish } from "@/components/forms/draft-bar";
import {
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  focusField,
  useFormErrors,
} from "@/components/forms/form-errors";
import { IndicatorPicker } from "@/components/forms/indicator-picker";
import { LanguageSwitch } from "@/components/forms/language-switch";
import { portalUrl } from "@/lib/content";
import { MAX_CHIPS, MAX_FEATURED } from "@/lib/editorial";
import { useLanguageName } from "@/lib/languages";
import type { PickerIndicator } from "@/lib/picker-data";

type Chip = HomeModules["exampleChips"][number] & { key: number };

/** Home page modules (brief §7): example chips, featured indicators, map and benchmark picks. */
export function HomeEditor({
  initial,
  indicators,
  locales,
  defaultLocale,
}: {
  initial: HomeModulesAdmin;
  indicators: PickerIndicator[];
  locales: string[];
  defaultLocale: string;
}) {
  const t = useTranslations("Admin.pages.home");
  const forms = useTranslations("Admin.forms");
  const locale = useLocale();
  const languageName = useLanguageName();
  const form = useFormErrors();
  const nextKey = useRef(initial.exampleChips.length);
  const [chips, setChips] = useState<Chip[]>(
    initial.exampleChips.map((chip, key) => ({ ...chip, key })),
  );
  const [featured, setFeatured] = useState(initial.featuredIndicators);
  const [mapTeaser, setMapTeaser] = useState(initial.mapTeaserIndicator);
  const [benchmark, setBenchmark] = useState(initial.benchmarkIndicator);
  const [language, setLanguage] = useState(defaultLocale);
  const draft = useDraftPublish<HomeModulesAdmin>({
    path: "/pages/home",
    initial,
    body: (): HomeModules => ({
      exampleChips: chips.map(({ label, href }) => ({ label, href })),
      featuredIndicators: featured,
      mapTeaserIndicator: mapTeaser,
      benchmarkIndicator: benchmark,
    }),
    onSaved: form.clear,
    onError: form.show,
  });

  const updateChip = (key: number, patch: Partial<Chip>) => {
    setChips((current) => current.map((chip) => (chip.key === key ? { ...chip, ...patch } : chip)));
    draft.touch();
  };
  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };
  const label = (path: string) => {
    const parts = path.split(".");
    if (parts[0] !== "exampleChips") return t(`field.${parts[0] as "featuredIndicators"}`);
    if (parts.length === 1) return t("chips");
    const field = t(`field.${parts[2] === "href" ? "href" : "label"}`);
    return forms("errorIn", {
      where: t("chipN", { number: Number(parts[1]) + 1 }),
      field: parts[3] ? forms("fieldIn", { field, language: languageName(parts[3]) }) : field,
    });
  };
  const flagged = locales.filter((code) =>
    form.errors.some((error) => error.path.endsWith(`.${code}`)),
  );

  return (
    <div className="mt-2 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-h1">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">{t("intro")}</p>
        </div>
        <DraftBar draft={draft} portalHref={portalUrl(`/${locale}`)} />
      </div>
      <ErrorSummary
        ref={form.summary}
        title={forms("errorTitle", { count: form.errors.length })}
        items={form.errors.map((error) => {
          const code = error.path.split(".").at(-1)!;
          return {
            href: `#${form.fieldId(error.path)}`,
            text: forms("errorLine", {
              field: label(error.path),
              message: forms(`error.${errorCode(error.message)}`),
            }),
            onClick: () => {
              if (locales.includes(code)) setLanguage(code);
              focusField(form.fieldId(error.path));
            },
          };
        })}
      />

      <section aria-labelledby={form.fieldId("chips-title")} className="flex flex-col gap-3">
        <h2 id={form.fieldId("chips-title")} className="text-h2">
          {t("chips")}
        </h2>
        <p className="text-muted-foreground max-w-2xl">{t("chipsHelp")}</p>
        <LanguageSwitch
          locales={locales}
          value={language}
          onChange={setLanguage}
          flagged={flagged}
        />
        <ul id={form.fieldId("exampleChips")} tabIndex={-1} className="flex flex-col gap-3">
          {chips.map((chip, index) => {
            const labelPath = `exampleChips.${index}.label.${language}`;
            const hrefPath = `exampleChips.${index}.href`;
            return (
              <li key={chip.key}>
                <fieldset className="grid items-start gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <legend className="sr-only">{t("chipN", { number: index + 1 })}</legend>
                  <div>
                    <label htmlFor={form.fieldId(labelPath)} className="mb-1 block font-semibold">
                      {t("field.label")}
                      {language === defaultLocale && (
                        <span className="text-muted-foreground ms-1 text-sm font-normal">
                          {forms("required")}
                        </span>
                      )}
                    </label>
                    <input
                      id={form.fieldId(labelPath)}
                      lang={language}
                      className={FIELD}
                      value={chip.label[language] ?? ""}
                      aria-invalid={Boolean(form.errorFor(labelPath))}
                      aria-describedby={form.describedBy(labelPath)}
                      onChange={(event) =>
                        updateChip(chip.key, {
                          label: { ...chip.label, [language]: event.target.value },
                        })
                      }
                    />
                    <FieldMessage
                      id={`${form.fieldId(labelPath)}-error`}
                      text={errorText(labelPath)}
                    />
                  </div>
                  <div>
                    <label htmlFor={form.fieldId(hrefPath)} className="mb-1 block font-semibold">
                      {t("field.href")}
                    </label>
                    <input
                      id={form.fieldId(hrefPath)}
                      className={`${FIELD} font-mono`}
                      value={chip.href}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={Boolean(form.errorFor(hrefPath))}
                      aria-describedby={form.describedBy(hrefPath, `${form.fieldId("href")}-hint`)}
                      onChange={(event) => updateChip(chip.key, { href: event.target.value })}
                    />
                    <FieldMessage
                      id={`${form.fieldId(hrefPath)}-error`}
                      text={errorText(hrefPath)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:mt-7"
                    aria-label={t("removeChip", { number: index + 1 })}
                    onClick={() => {
                      setChips(chips.filter((item) => item.key !== chip.key));
                      form.clear();
                      draft.touch();
                      focusField(form.fieldId("addChip"));
                    }}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </fieldset>
              </li>
            );
          })}
        </ul>
        <p id={`${form.fieldId("href")}-hint`} className="text-muted-foreground text-sm">
          {t("hrefHint")}
        </p>
        <FieldMessage
          id={`${form.fieldId("exampleChips")}-error`}
          text={errorText("exampleChips")}
        />
        <div>
          <Button
            id={form.fieldId("addChip")}
            type="button"
            variant="secondary"
            disabled={chips.length >= MAX_CHIPS}
            onClick={() => {
              const index = chips.length;
              setChips([...chips, { label: {}, href: "/", key: nextKey.current++ }]);
              draft.touch();
              focusField(form.fieldId(`exampleChips.${index}.label.${language}`));
            }}
          >
            <PlusIcon aria-hidden="true" />
            {t("addChip")}
          </Button>
        </div>
      </section>

      <section aria-labelledby={form.fieldId("indicators-title")} className="flex flex-col gap-4">
        <h2 id={form.fieldId("indicators-title")} className="text-h2">
          {t("indicators")}
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <IndicatorPicker
            id={form.fieldId("featuredIndicators")}
            label={t("field.featuredIndicators")}
            indicators={indicators}
            value={featured}
            max={MAX_FEATURED}
            error={errorText("featuredIndicators")}
            onChange={(codes) => {
              setFeatured(codes);
              draft.touch();
            }}
          />
          <div className="flex flex-col gap-6">
            <IndicatorPicker
              id={form.fieldId("mapTeaserIndicator")}
              label={t("field.mapTeaserIndicator")}
              indicators={indicators}
              value={mapTeaser ? [mapTeaser] : []}
              max={1}
              error={errorText("mapTeaserIndicator")}
              onChange={(codes) => {
                setMapTeaser(codes[0] ?? "");
                draft.touch();
              }}
            />
            <IndicatorPicker
              id={form.fieldId("benchmarkIndicator")}
              label={t("field.benchmarkIndicator")}
              indicators={indicators}
              value={benchmark ? [benchmark] : []}
              max={1}
              error={errorText("benchmarkIndicator")}
              onChange={(codes) => {
                setBenchmark(codes[0] ?? "");
                draft.touch();
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
