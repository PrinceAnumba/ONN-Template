import "server-only";
import { api } from "@onn/api-client";
import { country } from "@onn/config";

export interface PickerIndicator {
  code: string;
  name: string;
  disaggregations: string[];
}
export interface PickerOption {
  code: string;
  name: string;
}
export interface PickerData {
  indicators: PickerIndicator[];
  /** The country and its first-level areas. */
  areas: PickerOption[];
  /** Peer groups, as comparison values (`peer:CODE`). */
  peers: PickerOption[];
}

/** Published indicators, areas and peer groups for the dashboard and report pickers. */
export async function pickerData(locale: string): Promise<PickerData> {
  const ctx = { locale };
  const [page, areas] = await Promise.all([
    api.indicators(ctx, { pageSize: 500, status: "published" }),
    api.areas(ctx, { level: "adm1" }),
  ]);
  const national = await api.areas(ctx, { level: "country" }).catch(() => []);
  const groupName = (name: Record<string, string>) =>
    name[locale] ?? name[country.locales.default] ?? Object.values(name)[0] ?? "";
  return {
    indicators: page.items
      .filter((item) => item.status === "published")
      .map((item) => ({ code: item.code, name: item.name, disaggregations: item.disaggregations }))
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
    areas: [...national.filter((area) => area.code === country.iso3), ...areas].map((area) => ({
      code: area.code,
      name: area.name,
    })),
    peers: Object.entries(country.peers.groups).map(([code, group]) => ({
      code: `peer:${code}`,
      name: groupName(group.name as Record<string, string>),
    })),
  };
}
