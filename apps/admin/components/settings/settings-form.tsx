"use client";

import type {
  ApiQuota,
  FeatureKey,
  RuntimeSettingKey,
  SettingsAdmin,
  SettingsInput,
} from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  useFormErrors,
} from "@/components/forms/form-errors";
import { bff } from "@/lib/bff";
import { FEATURE_KEYS, QUOTA_TIERS, SETTING_KEYS } from "@/lib/governance";
import { useUnsavedWarning } from "@/lib/use-unsaved";

const LIMITS = ["perMinute", "perDay"] as const;
/** Numbers are kept as typed, so a half-typed value isn't lost. */
type QuotaText = Record<ApiQuota["tier"], Record<(typeof LIMITS)[number], string>>;

/**
 * Settings (brief §7): runtime overrides of the deployment's values, feature toggles and API
 * quotas, saved together. An empty override means "use the default", which is shown beside it.
 */
export function SettingsForm({
  initial,
  /** Defaults already formatted for the reader's language. */
  defaultText,
}: {
  initial: SettingsAdmin;
  defaultText: Record<RuntimeSettingKey, string>;
}) {
  const t = useTranslations("Admin.settings");
  const forms = useTranslations("Admin.forms");
  const router = useRouter();
  const form = useFormErrors();
  const [overrides, setOverrides] = useState(
    Object.fromEntries(SETTING_KEYS.map((key) => [key, initial.overrides[key] ?? ""])) as Record<
      RuntimeSettingKey,
      string
    >,
  );
  const [features, setFeatures] = useState(initial.features);
  const [quotas, setQuotas] = useState<QuotaText>(
    Object.fromEntries(
      QUOTA_TIERS.map((tier) => {
        const found = initial.quotas.find((quota) => quota.tier === tier);
        return [
          tier,
          { perMinute: String(found?.perMinute ?? ""), perDay: String(found?.perDay ?? "") },
        ];
      }),
    ) as QuotaText,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useUnsavedWarning(dirty);
  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };
  const fieldLabel = (path: string) => {
    const [head, second, third] = path.split(".");
    if (head === "overrides") return t(`override.${second as RuntimeSettingKey}`);
    if (head === "quotas") {
      return forms("errorIn", {
        where: t(`tier.${QUOTA_TIERS[Number(second)] ?? "anonymous"}`),
        field: t(`limit.${third as "perDay"}`),
      });
    }
    return path;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    form.clear();
    setSaving(true);
    const number = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value) : Number.NaN);
    const body: SettingsInput = {
      overrides: Object.fromEntries(
        SETTING_KEYS.map((key) => [key, overrides[key].trim() || null]),
      ) as SettingsInput["overrides"],
      features,
      quotas: QUOTA_TIERS.map((tier) => ({
        tier,
        // NaN becomes null in JSON, which the server reports as out of range.
        perMinute: number(quotas[tier].perMinute),
        perDay: number(quotas[tier].perDay),
      })),
    };
    try {
      await bff<SettingsAdmin>("/settings", { method: "PUT", body });
      setDirty(false);
      showToast(t("saved"));
      router.refresh();
    } catch (error) {
      if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="flex max-w-3xl flex-col gap-10">
      <ErrorSummary
        ref={form.summary}
        title={forms("errorTitle", { count: form.errors.length })}
        items={form.errors.map((error) => ({
          href: `#${form.fieldId(error.path)}`,
          text: forms("errorLine", {
            field: fieldLabel(error.path),
            message: forms(`error.${errorCode(error.message)}`),
          }),
        }))}
      />

      <section aria-labelledby={form.fieldId("h-overrides")}>
        <h2 id={form.fieldId("h-overrides")} className="text-h3">
          {t("overrides")}
        </h2>
        <p className="text-muted-foreground mt-1 mb-4">{t("overridesHelp")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SETTING_KEYS.map((key) => {
            const path = `overrides.${key}`;
            return (
              <div key={key}>
                <label htmlFor={form.fieldId(path)} className="mb-1 block font-semibold">
                  {t(`override.${key}`)}
                </label>
                <input
                  id={form.fieldId(path)}
                  className={`${FIELD} ${key === "contactEmail" ? "" : "tabular-nums"}`}
                  type={key === "contactEmail" ? "email" : "text"}
                  inputMode={key === "contactEmail" ? "email" : "numeric"}
                  autoComplete="off"
                  value={overrides[key]}
                  aria-invalid={Boolean(form.errorFor(path))}
                  aria-describedby={form.describedBy(path, `${form.fieldId(path)}-hint`)}
                  onChange={(event) => {
                    setOverrides({ ...overrides, [key]: event.target.value });
                    setDirty(true);
                  }}
                />
                <p id={`${form.fieldId(path)}-hint`} className="text-muted-foreground mt-1 text-sm">
                  {t(`overrideHelp.${key}`)} {t("defaultIs", { value: defaultText[key] })}
                </p>
                <FieldMessage id={`${form.fieldId(path)}-error`} text={errorText(path)} />
              </div>
            );
          })}
        </div>
      </section>

      <fieldset className="min-w-0">
        <legend className="text-h3">{t("features")}</legend>
        <p className="text-muted-foreground mt-1 mb-2">{t("featuresHelp")}</p>
        {FEATURE_KEYS.map((key: FeatureKey) => (
          <div key={key} className="border-t py-2">
            <label className="flex min-h-11 items-center gap-2 font-semibold">
              <input
                type="checkbox"
                className="size-5 shrink-0"
                checked={features[key]}
                aria-describedby={`${form.fieldId(`feature-${key}`)}-hint`}
                onChange={(event) => {
                  setFeatures({ ...features, [key]: event.target.checked });
                  setDirty(true);
                }}
              />
              {t(`feature.${key}`)}
            </label>
            <p
              id={`${form.fieldId(`feature-${key}`)}-hint`}
              className="text-muted-foreground ms-7 text-sm"
            >
              {t(`featureHelp.${key}`)}{" "}
              {t(initial.featureDefaults[key] ? "defaultOn" : "defaultOff")}
            </p>
          </div>
        ))}
      </fieldset>

      <section aria-labelledby={form.fieldId("h-quotas")}>
        <h2 id={form.fieldId("h-quotas")} className="text-h3">
          {t("quotas")}
        </h2>
        <p className="text-muted-foreground mt-1 mb-4">{t("quotasHelp")}</p>
        <div className="flex flex-col gap-4">
          {QUOTA_TIERS.map((tier, index) => (
            <fieldset key={tier} className="min-w-0 rounded-lg border p-4">
              <legend className="px-1 font-semibold">{t(`tier.${tier}`)}</legend>
              <p className="text-muted-foreground mb-3 text-sm">{t(`tierHelp.${tier}`)}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {LIMITS.map((limit) => {
                  const path = `quotas.${index}.${limit}`;
                  return (
                    <div key={limit}>
                      <label htmlFor={form.fieldId(path)} className="mb-1 block font-semibold">
                        {t(`limit.${limit}`)}
                      </label>
                      <input
                        id={form.fieldId(path)}
                        className={`${FIELD} tabular-nums`}
                        inputMode="numeric"
                        autoComplete="off"
                        value={quotas[tier][limit]}
                        aria-invalid={Boolean(form.errorFor(path))}
                        aria-describedby={form.describedBy(path)}
                        onChange={(event) => {
                          setQuotas({
                            ...quotas,
                            [tier]: { ...quotas[tier], [limit]: event.target.value },
                          });
                          setDirty(true);
                        }}
                      />
                      <FieldMessage id={`${form.fieldId(path)}-error`} text={errorText(path)} />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving && <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />}
          {forms("save")}
        </Button>
        {dirty && <p className="text-muted-foreground text-sm">{forms("unsaved")}</p>}
      </div>
    </form>
  );
}
