export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  /** Hierarchy depth, shown as indentation. */
  indent?: number;
  /** Extra search terms: codes, synonyms. */
  keywords?: string[];
}

export interface ComboboxGroup {
  label?: string;
  options: ComboboxOption[];
}

export function normaliseText(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function filterGroups(groups: ComboboxGroup[], query: string): ComboboxGroup[] {
  const needle = normaliseText(query.trim());
  if (!needle) return groups;
  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((option) =>
        normaliseText([option.label, ...(option.keywords ?? [])].join(" ")).includes(needle),
      ),
    }))
    .filter((group) => group.options.length > 0);
}
