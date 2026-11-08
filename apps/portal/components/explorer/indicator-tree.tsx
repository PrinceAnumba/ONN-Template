"use client";

import { cn } from "@onn/ui/lib/utils";
import { ChevronRightIcon, SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { filterTree, type TreePillar } from "@/lib/explorer-tree";

export interface TreeLabels {
  tree: string;
  filter: string;
  /** Template with `{query}`. */
  noMatches: string;
  /** Count per pillar or theme, already formatted; read out only while unfiltered. */
  counts: Record<string, string>;
}

/**
 * Pillar → theme → indicator tree with disclosure buttons and a filter (brief §5.2). The branch
 * holding the current indicator starts open; filtering opens every matching branch.
 */
export function IndicatorTree({
  tree,
  labels,
  onNavigate,
}: {
  tree: TreePillar[];
  labels: TreeLabels;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = useId();
  const current = pathname.startsWith("/data/") ? decodeURIComponent(pathname.slice(6)) : null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(() => {
    const start = new Set<string>();
    for (const pillar of tree) {
      for (const theme of pillar.themes) {
        if (theme.indicators.some((item) => item.code === current)) {
          start.add(pillar.code);
          start.add(`${pillar.code}/${theme.code}`);
        }
      }
    }
    return start;
  });
  const visible = useMemo(() => filterTree(tree, query), [tree, query]);
  const filtering = query.trim().length > 0;

  // Keep the area and comparison when moving between indicators.
  const keep = new URLSearchParams();
  for (const key of ["a", "c"]) {
    const value = searchParams.get(key);
    if (value) keep.set(key, value);
  }
  const suffix = keep.size ? `?${keep}` : "";

  const toggle = (key: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const isOpen = (key: string) => filtering || open.has(key);

  return (
    <div>
      <div className="relative">
        <SearchIcon
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        />
        <label htmlFor={`${id}-filter`} className="sr-only">
          {labels.filter}
        </label>
        <input
          id={`${id}-filter`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={labels.filter}
          className="bg-background h-11 w-full rounded-md border ps-9 pe-3"
        />
      </div>
      <p
        role="status"
        className={cn("text-muted-foreground mt-3 text-sm", visible.length && "sr-only")}
      >
        {visible.length ? "" : labels.noMatches.replace("{query}", query)}
      </p>
      <ul aria-label={labels.tree} className="mt-2 flex flex-col gap-1">
        {visible.map((pillar) => (
          <li key={pillar.code}>
            <button
              type="button"
              aria-expanded={isOpen(pillar.code)}
              aria-controls={`${id}-${pillar.code}`}
              onClick={() => toggle(pillar.code)}
              className="hover:bg-surface-2 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-start font-semibold"
            >
              <ChevronRightIcon
                aria-hidden
                className={cn(
                  "size-4 shrink-0 transition-transform duration-(--onn-dur-1) motion-reduce:transition-none rtl:rotate-180",
                  isOpen(pillar.code) && "rotate-90 rtl:rotate-90",
                )}
              />
              <span className="flex-1">{pillar.name}</span>
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                <span aria-hidden>{pillar.count}</span>
                {!filtering && <span className="sr-only">{labels.counts[pillar.code]}</span>}
              </span>
            </button>
            <ul id={`${id}-${pillar.code}`} hidden={!isOpen(pillar.code)} className="ms-4">
              {pillar.themes.map((theme) => {
                const key = `${pillar.code}/${theme.code}`;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-expanded={isOpen(key)}
                      aria-controls={`${id}-${key}`}
                      onClick={() => toggle(key)}
                      className="hover:bg-surface-2 flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-start text-sm font-medium"
                    >
                      <ChevronRightIcon
                        aria-hidden
                        className={cn(
                          "size-4 shrink-0 transition-transform duration-(--onn-dur-1) motion-reduce:transition-none rtl:rotate-180",
                          isOpen(key) && "rotate-90 rtl:rotate-90",
                        )}
                      />
                      <span className="flex-1">{theme.name}</span>
                      <span className="text-muted-foreground text-xs font-normal tabular-nums">
                        <span aria-hidden>{theme.indicators.length}</span>
                        {!filtering && <span className="sr-only">{labels.counts[key]}</span>}
                      </span>
                    </button>
                    <ul id={`${id}-${key}`} hidden={!isOpen(key)} className="ms-6">
                      {theme.indicators.map((item) => {
                        const active = item.code === current;
                        return (
                          <li key={item.code}>
                            <Link
                              href={`/data/${item.code}${suffix}`}
                              onClick={onNavigate}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "flex min-h-11 items-center border-s-3 py-1 ps-3 pe-2 text-sm",
                                active
                                  ? "border-primary bg-surface-2 font-semibold"
                                  : "hover:bg-surface-2 border-transparent",
                              )}
                            >
                              {item.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
