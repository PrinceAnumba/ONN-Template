"use client";

import { Button } from "@onn/ui/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import type { SelectorData } from "@/lib/selector-data";
import {
  buildSelectorGroups,
  DASHBOARD_PREFIX,
  SelectorFields,
  type Selection,
} from "../selector/selector-fields";

/** The selector bar inline in the hero. Nothing goes in the URL until "Explore" (brief §5.1). */
export function HeroSelector({ data, exploreLabel }: { data: SelectorData; exploreLabel: string }) {
  const t = useTranslations("Selector");
  const locale = useLocale();
  const router = useRouter();
  const groups = useMemo(() => buildSelectorGroups(data, locale, t), [data, locale, t]);
  const [selection, setSelection] = useState<Selection>({
    indicator: null,
    area: null,
    comparison: null,
  });

  const explore = (event: FormEvent) => {
    event.preventDefault();
    const query = new URLSearchParams();
    if (selection.area) query.set("a", selection.area);
    if (selection.comparison) query.set("c", selection.comparison);
    const value = selection.indicator;
    const path = value?.startsWith(DASHBOARD_PREFIX)
      ? `/dashboards/${value.slice(DASHBOARD_PREFIX.length)}`
      : value
        ? `/data/${value}`
        : "/data";
    router.push(query.size ? `${path}?${query}` : path);
  };

  return (
    <form onSubmit={explore} className="flex flex-col gap-3 md:flex-row md:items-end">
      <SelectorFields
        groups={groups}
        value={selection}
        onChange={setSelection}
        className="grid flex-1 gap-3 md:grid-cols-3"
      />
      <Button type="submit" size="lg">
        {exploreLabel}
      </Button>
    </form>
  );
}
