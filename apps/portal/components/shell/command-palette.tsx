"use client";

import { api } from "@onn/api-client";
import { country } from "@onn/config";
import { createQueryClient } from "@onn/api-client/hooks";
import { normaliseText } from "@onn/ui/components/combobox-filter";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@onn/ui/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@onn/ui/components/ui/dialog";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { SEARCHABLE_PAGES } from "@/lib/nav";

const DEBOUNCE_MS = 200;
const POPULAR_COUNT = 6;
const RESULTS_PER_GROUP = 5;

const queryClient = createQueryClient();

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

function usePaletteResults(query: string) {
  const locale = useLocale();
  const q = query.trim();
  const enabled = q.length > 0;
  const size = { pageSize: RESULTS_PER_GROUP };

  const popular = useQuery({
    queryKey: ["palette", "popular", locale],
    queryFn: ({ signal }) =>
      api.indicators({ locale, signal }, { headline: true, pageSize: POPULAR_COUNT }),
  });
  const indicators = useQuery({
    queryKey: ["palette", "indicators", locale, q],
    queryFn: ({ signal }) => api.indicators({ locale, signal }, { q, ...size }),
    enabled,
  });
  const areas = useQuery({
    queryKey: ["palette", "areas", locale, q],
    queryFn: ({ signal }) => api.areas({ locale, signal }, { q }),
    enabled,
  });
  const publications = useQuery({
    queryKey: ["palette", "publications", locale, q],
    queryFn: ({ signal }) => api.publications({ locale, signal }, { q }),
    enabled,
  });
  const news = useQuery({
    queryKey: ["palette", "news", locale, q],
    queryFn: ({ signal }) => api.news({ locale, signal }, { q }),
    enabled,
  });

  return {
    popular: popular.data?.items ?? [],
    indicators: indicators.data?.items ?? [],
    // Peer countries have no page of their own in the portal.
    areas: (areas.data ?? [])
      .filter((area) => area.level.startsWith("adm"))
      .slice(0, RESULTS_PER_GROUP),
    publications: (publications.data?.items ?? []).slice(0, RESULTS_PER_GROUP),
    news: (news.data?.items ?? []).slice(0, RESULTS_PER_GROUP),
    loading: enabled && (indicators.isFetching || areas.isFetching),
  };
}

function PaletteBody({ onNavigate }: { onNavigate: (href: string) => void }) {
  const t = useTranslations("Palette");
  const nav = useTranslations("Nav");
  const locale = useLocale();
  const levelLabel = (level: string) =>
    country.geography.levels.find((item) => item.key === level)?.label[locale];
  const [input, setInput] = useState("");
  const query = useDebounced(input);
  const results = usePaletteResults(query);
  const needle = normaliseText(query.trim());
  const pages = needle
    ? SEARCHABLE_PAGES.filter((page) => normaliseText(nav(page.key)).includes(needle))
    : [];
  const hasResults =
    results.indicators.length +
      results.areas.length +
      results.publications.length +
      results.news.length +
      pages.length >
    0;

  return (
    <Command shouldFilter={false} label={t("title")}>
      <CommandInput
        value={input}
        onValueChange={setInput}
        placeholder={t("placeholder")}
        className="focus-visible:shadow-none"
      />
      <CommandList className="max-h-[420px]">
        {needle && !hasResults && !results.loading && (
          <p className="px-3 py-4 text-sm">{t("noResults", { query: query.trim() })}</p>
        )}
        {(!needle || !hasResults) && !results.loading && (
          <CommandGroup heading={t("popular")}>
            {results.popular.map((item) => (
              <CommandItem
                key={item.code}
                value={`popular-${item.code}`}
                onSelect={() => onNavigate(`/data/${item.code}`)}
              >
                {item.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.indicators.length > 0 && (
          <CommandGroup heading={t("indicators")}>
            {results.indicators.map((item) => (
              <CommandItem
                key={item.code}
                value={`indicator-${item.code}`}
                onSelect={() => onNavigate(`/data/${item.code}`)}
              >
                <span className="min-w-0">
                  <span className="block truncate">{item.name}</span>
                  <span className="text-muted-foreground block text-xs">{item.code}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.areas.length > 0 && (
          <CommandGroup heading={t("areas")}>
            {results.areas.map((area) => (
              <CommandItem
                key={area.code}
                value={`area-${area.code}`}
                onSelect={() => onNavigate(`/data?a=${area.code}`)}
              >
                <span className="min-w-0">
                  <span className="block truncate">{area.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    {levelLabel(area.level)}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.publications.length > 0 && (
          <CommandGroup heading={t("publications")}>
            {results.publications.map((item) => (
              <CommandItem
                key={item.slug}
                value={`publication-${item.slug}`}
                onSelect={() => onNavigate(`/publications/${item.slug}`)}
              >
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.news.length > 0 && (
          <CommandGroup heading={t("news")}>
            {results.news.map((item) => (
              <CommandItem
                key={item.slug}
                value={`news-${item.slug}`}
                onSelect={() => onNavigate(`/news/${item.slug}`)}
              >
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {pages.length > 0 && (
          <CommandGroup heading={t("pages")}>
            {pages.map((page) => (
              <CommandItem
                key={page.key}
                value={`page-${page.key}`}
                onSelect={() => onNavigate(page.href)}
              >
                {nav(page.key)}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const t = useTranslations("Palette");
  const common = useTranslations("Common");
  const router = useRouter();

  return (
    <QueryClientProvider client={queryClient}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          closeLabel={common("close")}
          className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[640px]"
        >
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("placeholder")}</DialogDescription>
          <PaletteBody
            onNavigate={(href) => {
              onOpenChange(false);
              router.push(href);
            }}
          />
        </DialogContent>
      </Dialog>
    </QueryClientProvider>
  );
}
