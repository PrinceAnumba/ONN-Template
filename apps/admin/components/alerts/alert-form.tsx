"use client";

import type { AlertRule, AlertRuleInput, AlertRules } from "@onn/api-client/types";
import { showToast } from "@onn/ui/components/toast";
import { Button } from "@onn/ui/components/ui/button";
import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/forms/confirm-dialog";
import {
  ErrorSummary,
  errorCode,
  FIELD,
  FieldMessage,
  useFormErrors,
} from "@/components/forms/form-errors";
import { IndicatorPicker } from "@/components/forms/indicator-picker";
import { bff } from "@/lib/bff";
import { ALERT_CHANNELS, ALERT_CONDITIONS } from "@/lib/editorial";
import type { PickerIndicator } from "@/lib/picker-data";

const toggle = <T,>(list: T[], item: T, on: boolean) =>
  on ? [...list, item] : list.filter((entry) => entry !== item);

/**
 * Alert rule (brief §7): an indicator, what to watch for, who to tell and how. Only the fields
 * the chosen condition uses are shown.
 */
export function AlertForm({
  initial,
  people,
  indicators,
}: {
  /** Absent while creating. */
  initial?: AlertRule;
  people: AlertRules["people"];
  indicators: PickerIndicator[];
}) {
  const t = useTranslations("Admin.alerts");
  const forms = useTranslations("Admin.forms");
  const router = useRouter();
  const form = useFormErrors();
  const [input, setInput] = useState<AlertRuleInput>(
    initial ?? {
      name: "",
      indicator: "",
      condition: "threshold",
      operator: "below",
      recipients: [],
      channels: ["email"],
      enabled: true,
    },
  );
  // Kept as text so a half-typed number ("-", "1,") isn't lost.
  const [value, setValue] = useState(initial?.value === undefined ? "" : String(initial.value));
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const change = (patch: Partial<AlertRuleInput>) => setInput({ ...input, ...patch });
  const valued = input.condition === "threshold" || input.condition === "change";
  const errorText = (path: string) => {
    const error = form.errorFor(path);
    return error ? forms(`error.${errorCode(error.message)}`) : undefined;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    form.clear();
    setBusy("save");
    const number = Number(value.replace(",", "."));
    const body: AlertRuleInput = {
      ...input,
      operator: input.condition === "threshold" ? (input.operator ?? "below") : undefined,
      value: valued && value.trim() && Number.isFinite(number) ? number : undefined,
    };
    try {
      if (initial) {
        await bff<AlertRule>(`/alerts/${initial.id}`, { method: "PUT", body });
        showToast(t("saved"));
        router.refresh();
      } else {
        await bff<AlertRule>("/alerts", { method: "POST", body });
        showToast(t("created"));
        router.push("/alerts");
      }
    } catch (error) {
      if (!form.show(error)) showToast(forms("saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!initial) return;
    setBusy("delete");
    try {
      await bff(`/alerts/${initial.id}`, { method: "DELETE" });
      showToast(t("deleted"));
      router.push("/alerts");
    } catch {
      showToast(forms("saveFailed"), "error");
      setBusy(null);
      setConfirming(false);
    }
  };

  const group = (name: "recipients" | "channels", options: { value: string; label: string }[]) => (
    <fieldset
      id={form.fieldId(name)}
      tabIndex={-1}
      aria-describedby={form.describedBy(name)}
      className="min-w-0"
    >
      <legend className="font-semibold">{t(`field.${name}`)}</legend>
      <div className="mt-1 flex flex-col">
        {options.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              className="size-5"
              checked={(input[name] as string[]).includes(option.value)}
              onChange={(event) =>
                change({
                  [name]: toggle(input[name] as string[], option.value, event.target.checked),
                })
              }
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldMessage id={`${form.fieldId(name)}-error`} text={errorText(name)} />
    </fieldset>
  );

  return (
    <form onSubmit={save} noValidate className="flex max-w-3xl flex-col gap-6">
      <ErrorSummary
        ref={form.summary}
        title={forms("errorTitle", { count: form.errors.length })}
        items={form.errors.map((error) => ({
          href: `#${form.fieldId(error.path)}`,
          text: forms("errorLine", {
            field: t(`field.${error.path as "name"}`),
            message: forms(`error.${errorCode(error.message)}`),
          }),
        }))}
      />
      <div>
        <label htmlFor={form.fieldId("name")} className="mb-1 block font-semibold">
          {t("field.name")}
        </label>
        <input
          id={form.fieldId("name")}
          className={FIELD}
          value={input.name}
          maxLength={80}
          aria-invalid={Boolean(form.errorFor("name"))}
          aria-describedby={form.describedBy("name")}
          onChange={(event) => change({ name: event.target.value })}
        />
        <FieldMessage id={`${form.fieldId("name")}-error`} text={errorText("name")} />
      </div>
      <IndicatorPicker
        id={form.fieldId("indicator")}
        label={t("field.indicator")}
        indicators={indicators}
        value={input.indicator ? [input.indicator] : []}
        max={1}
        error={errorText("indicator")}
        onChange={(codes) => change({ indicator: codes[0] ?? "" })}
      />

      <fieldset id={form.fieldId("condition")} tabIndex={-1} className="min-w-0">
        <legend className="font-semibold">{t("field.condition")}</legend>
        <div className="mt-1 flex flex-col gap-1">
          {ALERT_CONDITIONS.map((condition) => (
            <div key={condition} className="py-1">
              <label className="flex min-h-11 items-center gap-2 font-semibold">
                <input
                  type="radio"
                  name={form.fieldId("condition")}
                  className="size-5 shrink-0"
                  checked={input.condition === condition}
                  aria-describedby={`${form.fieldId("condition")}-${condition}`}
                  onChange={() => change({ condition })}
                />
                {t(`condition.${condition}`)}
              </label>
              <p
                id={`${form.fieldId("condition")}-${condition}`}
                className="text-muted-foreground ms-7 text-sm"
              >
                {t(`conditionHelp.${condition}`)}
              </p>
            </div>
          ))}
        </div>
        <FieldMessage id={`${form.fieldId("condition")}-error`} text={errorText("condition")} />
      </fieldset>

      {valued && (
        <div className="grid gap-4 sm:grid-cols-2">
          {input.condition === "threshold" && (
            <div>
              <label htmlFor={form.fieldId("operator")} className="mb-1 block font-semibold">
                {t("field.operator")}
              </label>
              <select
                id={form.fieldId("operator")}
                className={FIELD}
                value={input.operator ?? "below"}
                aria-invalid={Boolean(form.errorFor("operator"))}
                aria-describedby={form.describedBy("operator")}
                onChange={(event) =>
                  change({ operator: event.target.value as AlertRuleInput["operator"] })
                }
              >
                <option value="below">{t("operator.below")}</option>
                <option value="above">{t("operator.above")}</option>
              </select>
              <FieldMessage id={`${form.fieldId("operator")}-error`} text={errorText("operator")} />
            </div>
          )}
          <div>
            <label htmlFor={form.fieldId("value")} className="mb-1 block font-semibold">
              {t(input.condition === "threshold" ? "field.value" : "field.percent")}
            </label>
            <input
              id={form.fieldId("value")}
              className={`${FIELD} tabular-nums`}
              inputMode="decimal"
              autoComplete="off"
              value={value}
              aria-invalid={Boolean(form.errorFor("value"))}
              aria-describedby={form.describedBy("value", `${form.fieldId("value")}-hint`)}
              onChange={(event) => setValue(event.target.value)}
            />
            <p id={`${form.fieldId("value")}-hint`} className="text-muted-foreground mt-1 text-sm">
              {t(input.condition === "threshold" ? "hint.value" : "hint.percent")}
            </p>
            <FieldMessage id={`${form.fieldId("value")}-error`} text={errorText("value")} />
          </div>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {group(
          "recipients",
          people.map((person) => ({ value: person.id, label: person.name })),
        )}
        {group(
          "channels",
          ALERT_CHANNELS.map((channel) => ({ value: channel, label: t(`channel.${channel}`) })),
        )}
      </div>

      <div>
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input
            type="checkbox"
            className="size-5"
            checked={input.enabled}
            aria-describedby={`${form.fieldId("enabled")}-hint`}
            onChange={(event) => change({ enabled: event.target.checked })}
          />
          {t("field.enabled")}
        </label>
        <p id={`${form.fieldId("enabled")}-hint`} className="text-muted-foreground ms-7 text-sm">
          {t("hint.enabled")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="submit" disabled={busy !== null}>
          {busy === "save" && (
            <LoaderCircleIcon aria-hidden="true" className="size-4 animate-spin" />
          )}
          {initial ? forms("save") : t("create")}
        </Button>
        {initial && (
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => setConfirming(true)}
          >
            {t("delete")}
          </Button>
        )}
      </div>
      {initial && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t("deleteTitle", { name: initial.name })}
          description={t("deleteHelp")}
          confirm={t("deleteConfirm")}
          danger
          pending={busy === "delete"}
          onConfirm={remove}
        />
      )}
    </form>
  );
}
