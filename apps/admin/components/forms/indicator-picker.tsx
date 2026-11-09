"use client";

import { Combobox } from "@onn/ui/components/combobox";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PickerIndicator } from "@/lib/picker-data";
import { FieldMessage } from "./form-errors";

/**
 * Picks one indicator (a combobox) or up to `max` (a list with remove buttons and a combobox to
 * add). `id` is the focus target for error summary links.
 */
export function IndicatorPicker({
  id,
  label,
  indicators,
  value,
  max,
  error,
  onChange,
}: {
  id: string;
  label: string;
  indicators: PickerIndicator[];
  value: string[];
  max: number;
  error?: string;
  onChange: (codes: string[]) => void;
}) {
  const t = useTranslations("Admin.picker");
  const options = indicators.map((item) => ({
    value: item.code,
    label: item.name,
    description: item.code,
  }));
  const name = (code: string) => indicators.find((item) => item.code === code)?.name ?? code;

  if (max === 1) {
    return (
      <div>
        <Combobox
          label={label}
          groups={[{ options }]}
          value={value[0] ?? null}
          onChange={(code) => onChange(code ? [code] : [])}
          clearLabel={t("clear")}
          noResultsLabel={t("noResults")}
        />
        <span id={id} tabIndex={-1} />
        <FieldMessage id={`${id}-error`} text={error} />
      </div>
    );
  }
  return (
    <fieldset>
      <legend className="font-semibold">
        {label}{" "}
        <span className="text-muted-foreground text-sm font-normal">
          {t("limit", { count: value.length, max })}
        </span>
      </legend>
      {value.length > 0 && (
        <ul id={id} tabIndex={-1} className="mt-1 flex flex-col gap-1">
          {value.map((code) => (
            <li key={code} className="flex items-center gap-2 rounded-md border ps-3">
              <span className="min-w-0 flex-1 truncate text-sm">{name(code)}</span>
              <button
                type="button"
                aria-label={t("remove", { name: name(code) })}
                onClick={() => onChange(value.filter((item) => item !== code))}
                className="hover:bg-surface-2 inline-flex size-11 items-center justify-center rounded-md"
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length === 0 && <span id={id} tabIndex={-1} />}
      {value.length < max && (
        <div className="mt-2">
          <Combobox
            label={t("add")}
            groups={[{ options: options.filter((option) => !value.includes(option.value)) }]}
            value={null}
            onChange={(code) => code && onChange([...value, code])}
            clearLabel={t("clear")}
            noResultsLabel={t("noResults")}
          />
        </div>
      )}
      <FieldMessage id={`${id}-error`} text={error} />
    </fieldset>
  );
}
