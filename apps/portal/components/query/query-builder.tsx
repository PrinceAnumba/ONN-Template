"use client";

import { Button } from "@onn/ui/components/ui/button";
import { YearSlider } from "@onn/ui/components/year-slider";
import { cn } from "@onn/ui/lib/utils";
import { ChevronDownIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { isComplete, queryString, type QueryState } from "@/lib/query";

export interface AreaNode {
  code: string;
  name: string;
  children: AreaNode[];
}

export interface QueryBuilderProps {
  indicators: { code: string; name: string; pillar: string }[];
  pillars: { code: string; name: string }[];
  tree: AreaNode[];
  peers: { code: string; name: string }[];
  groups: { code: string; name: string }[];
  coverage: [number, number];
  initial: QueryState;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** A checkbox whose `indeterminate` state follows the prop. */
function Check({
  checked,
  indeterminate = false,
  onChange,
  children,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary size-5 shrink-0"
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Step({
  n,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("Query");
  const id = useId();
  const heading = (
    <>
      <span className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
        <span aria-hidden>{n}</span>
        <span className="sr-only">{t("step", { n })}</span>
      </span>
      <span className="flex-1">{title}</span>
      {summary && <span className="text-muted-foreground text-sm font-normal">{summary}</span>}
    </>
  );
  return (
    <section className="border-b py-4 last:border-0">
      {/* Accordion under 1024 px; every step stays open beside the preview on desktop. */}
      <h2 className="text-h3 hidden items-center gap-3 lg:flex">{heading}</h2>
      <h2 className="text-h3 lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center gap-3 text-start"
        >
          {heading}
          <ChevronDownIcon aria-hidden className={cn("size-5 shrink-0", open && "rotate-180")} />
        </button>
      </h2>
      <div id={id} className={cn("mt-3", !open && "hidden lg:block")}>
        {children}
      </div>
    </section>
  );
}

/**
 * The three query steps (brief §5.7): indicators, areas and years. "Apply filters" writes the
 * selection to the URL, and the server renders the preview for it.
 */
export function QueryBuilder({
  indicators,
  pillars,
  tree,
  peers,
  groups,
  coverage,
  initial,
}: QueryBuilderProps) {
  const t = useTranslations("Query");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState(() => new Set(initial.indicators));
  const [areas, setAreas] = useState(() => new Set(initial.areas));
  const [years, setYears] = useState<[number, number]>(initial.years);
  const [search, setSearch] = useState("");
  const [pillarFilter, setPillarFilter] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState({ 1: true, 2: false, 3: false });
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree.map((node) => node.code)),
  );
  const searchId = useId();

  const visible = useMemo(() => {
    const needle = fold(search.trim());
    return indicators.filter(
      (item) =>
        (!pillarFilter.size || pillarFilter.has(item.pillar)) &&
        (!needle || fold(`${item.name} ${item.code}`).includes(needle)),
    );
  }, [indicators, search, pillarFilter]);

  const toggleIn = (set: Set<string>, values: string[], on: boolean) => {
    const next = new Set(set);
    values.forEach((value) => (on ? next.add(value) : next.delete(value)));
    return next;
  };
  const state: QueryState = { indicators: [...picked], areas: [...areas], years };
  const complete = isComplete(state);

  const apply = () =>
    startTransition(() => router.push(`/query?${queryString(state)}`, { scroll: false }));

  const descendants = (node: AreaNode): string[] => [
    node.code,
    ...node.children.flatMap(descendants),
  ];

  const renderNode = (node: AreaNode): ReactNode => {
    const childCodes = node.children.flatMap(descendants);
    const chosen = childCodes.filter((code) => areas.has(code)).length;
    const isOpen = expanded.has(node.code);
    return (
      <li key={node.code}>
        <div className="flex items-center gap-1">
          <Check
            checked={areas.has(node.code)}
            indeterminate={!areas.has(node.code) && chosen > 0}
            onChange={(on) => setAreas(toggleIn(areas, [node.code], on))}
          >
            {node.name}
          </Check>
          {node.children.length > 0 && (
            <button
              type="button"
              aria-expanded={isOpen}
              aria-label={t("showChildren", { name: node.name })}
              onClick={() => setExpanded(toggleIn(expanded, [node.code], !isOpen))}
              className="hover:bg-surface-2 flex size-11 shrink-0 items-center justify-center rounded-md"
            >
              <ChevronRightIcon
                aria-hidden
                className={cn("size-4 rtl:rotate-180", isOpen && "rotate-90 rtl:rotate-90")}
              />
            </button>
          )}
        </div>
        {node.children.length > 0 && isOpen && (
          <ul className="ms-6">{node.children.map(renderNode)}</ul>
        )}
      </li>
    );
  };

  const flatGroup = (title: string, items: { code: string; name: string }[]) => {
    if (!items.length) return null;
    const codes = items.map((item) => item.code);
    const chosen = codes.filter((code) => areas.has(code)).length;
    return (
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">{title}</legend>
        <Check
          checked={chosen === codes.length}
          indeterminate={chosen > 0 && chosen < codes.length}
          onChange={(on) => setAreas(toggleIn(areas, codes, on))}
        >
          {t("selectAll", { group: title })}
        </Check>
        <ul className="ms-6">
          {items.map((item) => (
            <li key={item.code}>
              <Check
                checked={areas.has(item.code)}
                onChange={(on) => setAreas(toggleIn(areas, [item.code], on))}
              >
                {item.name}
              </Check>
            </li>
          ))}
        </ul>
      </fieldset>
    );
  };

  return (
    <div>
      <Step
        n={1}
        title={t("indicators")}
        summary={t("selected", { count: picked.size })}
        open={open[1]}
        onToggle={() => setOpen({ ...open, 1: !open[1] })}
      >
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
          />
          <label htmlFor={searchId} className="sr-only">
            {t("search")}
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("search")}
            className="bg-background h-11 w-full rounded-md border ps-9 pe-3"
          />
        </div>
        <div role="group" aria-label={t("pillars")} className="mt-3 flex flex-wrap gap-2">
          {pillars.map((pillar) => {
            const on = pillarFilter.has(pillar.code);
            return (
              <button
                key={pillar.code}
                type="button"
                aria-pressed={on}
                onClick={() => setPillarFilter(toggleIn(pillarFilter, [pillar.code], !on))}
                className={cn(
                  "rounded-pill min-h-11 border px-3 text-sm",
                  on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-surface-2",
                )}
              >
                {pillar.name}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p role="status" className="text-sm">
            {t("selected", { count: picked.size })}
          </p>
          <Button variant="link" onClick={() => setPicked(new Set())} disabled={!picked.size}>
            {t("clearAll")}
          </Button>
        </div>
        <div
          role="group"
          aria-label={t("indicators")}
          // Scrollable region must be reachable by keyboard.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="mt-2 max-h-72 overflow-y-auto rounded-md border px-3"
        >
          {visible.length ? (
            <ul>
              {visible.map((item) => (
                <li key={item.code}>
                  <Check
                    checked={picked.has(item.code)}
                    onChange={(on) => setPicked(toggleIn(picked, [item.code], on))}
                  >
                    {item.name}
                  </Check>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground py-3 text-sm">{t("noMatches")}</p>
          )}
        </div>
      </Step>

      <Step
        n={2}
        title={t("areas")}
        summary={t("selected", { count: areas.size })}
        open={open[2]}
        onToggle={() => setOpen({ ...open, 2: !open[2] })}
      >
        <fieldset>
          <legend className="text-sm font-semibold">{t("country")}</legend>
          <ul>{tree.map(renderNode)}</ul>
        </fieldset>
        {flatGroup(t("peers"), peers)}
        {flatGroup(t("groups"), groups)}
      </Step>

      <Step
        n={3}
        title={t("years")}
        summary={`${years[0]}–${years[1]}`}
        open={open[3]}
        onToggle={() => setOpen({ ...open, 3: !open[3] })}
      >
        <YearSlider
          label={t("years")}
          min={coverage[0]}
          max={coverage[1]}
          value={years}
          onValueChange={setYears}
          thumbLabels={[t("fromYear"), t("toYear")]}
          className="px-2"
        />
      </Step>

      <div className="pt-4">
        <Button
          className="w-full"
          disabled={!complete}
          loading={pending}
          onClick={apply}
          aria-describedby={complete ? undefined : `${searchId}-hint`}
        >
          {t("apply")}
        </Button>
        {!complete && (
          <p id={`${searchId}-hint`} className="text-muted-foreground mt-2 text-sm">
            {t("applyHint")}
          </p>
        )}
      </div>
    </div>
  );
}
