"use client";

import { country } from "@onn/config";
import { Combobox, type ComboboxGroup } from "@onn/ui/components/combobox";
import { useTranslations } from "next-intl";
import type { SelectorData } from "@/lib/selector-data";

export const DASHBOARD_PREFIX = "dashboard:";

export interface Selection {
  indicator: string | null;
  area: string | null;
  comparison: string | null;
}

export interface SelectorGroups {
  indicator: ComboboxGroup[];
  focus: ComboboxGroup[];
  comparison: ComboboxGroup[];
  focusCodes: string[];
  comparisonCodes: string[];
}

type Translate = ReturnType<typeof useTranslations<"Selector">>;

function territoryGroups(data: SelectorData, locale: string): ComboboxGroup[] {
  return country.geography.levels.flatMap((level) => {
    const areas = data.areas.filter((area) => area.level === level.key);
    if (!areas.length) return [];
    const nameOf = (code?: string) => data.areas.find((area) => area.code === code)?.name;
    return [
      {
        label: level.label[locale],
        options: areas.map((area) => ({
          value: area.code,
          label: area.name,
          description: level.key === "adm1" ? undefined : nameOf(area.parent),
          indent: level.key === "adm1" ? 0 : 1,
        })),
      },
    ];
  });
}

export function buildSelectorGroups(
  data: SelectorData,
  locale: string,
  t: Translate,
): SelectorGroups {
  const byPillar = new Map<string, ComboboxGroup>();
  for (const item of data.indicators) {
    const label = `${item.pillar} › ${item.theme}`;
    const group = byPillar.get(label) ?? { label, options: [] };
    group.options.push({
      value: item.code,
      label: item.name,
      description: item.unit,
      badge: item.subnational ? t("subnational") : undefined,
      keywords: [item.code, ...item.synonyms],
    });
    byPillar.set(label, group);
  }

  const home = data.areas.find((area) => area.code === country.iso3);
  const territories = territoryGroups(data, locale);
  const focus: ComboboxGroup[] = [
    ...(home ? [{ options: [{ value: home.code, label: home.name }] }] : []),
    ...territories,
  ];
  const peerCountries = data.areas.filter(
    (area) => area.level === "country" && area.code !== country.iso3,
  );
  const peerGroups = data.areas.filter((area) => area.level === "group");
  const comparison: ComboboxGroup[] = [
    ...territories,
    {
      label: t("peerCountries"),
      options: peerCountries.map((area) => ({ value: area.code, label: area.name })),
    },
    {
      label: t("peerGroups"),
      options: peerGroups.map((area) => ({
        value: area.code,
        label: t("peerGroup", { name: area.name }),
      })),
    },
  ];

  const codes = (groups: ComboboxGroup[]) =>
    groups.flatMap((group) => group.options).map((option) => option.value);

  return {
    indicator: [
      {
        label: t("dashboards"),
        options: data.dashboards.map((dashboard) => ({
          value: `${DASHBOARD_PREFIX}${dashboard.slug}`,
          label: dashboard.title,
        })),
      },
      ...byPillar.values(),
    ],
    focus,
    comparison,
    focusCodes: codes(focus),
    comparisonCodes: codes(comparison),
  };
}

interface SelectorFieldsProps {
  groups: SelectorGroups;
  value: Selection;
  onChange: (next: Selection) => void;
  className?: string;
}

export function SelectorFields({ groups, value, onChange, className }: SelectorFieldsProps) {
  const t = useTranslations("Selector");
  const shared = { clearLabel: t("clear"), noResultsLabel: t("noResults") };
  return (
    <div className={className}>
      <Combobox
        {...shared}
        label={t("indicator")}
        placeholder={t("chooseData")}
        groups={groups.indicator}
        value={value.indicator}
        onChange={(indicator) => onChange({ ...value, indicator })}
      />
      <Combobox
        {...shared}
        label={t("focus")}
        groups={groups.focus}
        value={value.area ?? country.iso3}
        onChange={(area) => onChange({ ...value, area: area === country.iso3 ? null : area })}
      />
      <Combobox
        {...shared}
        label={t("comparison")}
        placeholder={t("none")}
        groups={groups.comparison}
        value={value.comparison}
        onChange={(comparison) => onChange({ ...value, comparison })}
      />
    </div>
  );
}
