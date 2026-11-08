import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { Page, Pillar, Publication } from "@onn/api-client/types";
import { Pagination } from "@onn/ui/components/pagination";
import { Button } from "@onn/ui/components/ui/button";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { FilterForm } from "@/components/publications/filter-form";
import { PublicationCard } from "@/components/publications/publication-card";

const PAGE_SIZE = 12;
const ALL = 500;
const TYPES = ["quarterly", "annual", "study", "method"] as const;

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => [value ?? ""].flat()[0]?.trim() ?? "";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("publications") };
}

/** Publications (brief §5.9): type, year and pillar filters, 12 cards per page. */
export default async function PublicationsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const locale = await getLocale();
  const ctx: RequestContext = { locale, next: serverCache("publications") };
  const [t, nav, common, params] = await Promise.all([
    getTranslations("Publications"),
    getTranslations("Nav"),
    getTranslations("Common"),
    searchParams,
  ]);

  let all: Publication[] = [];
  let pillars: Pillar[] = [];
  try {
    [all, pillars] = await Promise.all([
      api.publications(ctx, { pageSize: ALL }).then((page) => page.items),
      api.pillars(ctx),
    ]);
  } catch {
    // The list below reports the failure.
  }
  const years = [...new Set(all.map((item) => item.date.slice(0, 4)))].sort().reverse();
  const usedPillars = pillars
    .filter((pillar) => all.some((item) => item.pillar === pillar.code))
    .sort((a, b) => a.order - b.order);

  // Unknown values are dropped rather than returning an empty list.
  const type = TYPES.find((value) => value === one(params.type));
  const year = years.find((value) => value === one(params.year));
  const pillar = usedPillars.find((item) => item.code === one(params.pillar))?.code;
  const requested = Number.parseInt(one(params.page), 10);

  const load = (n: number) =>
    api.publications(ctx, { type, year, pillar, page: n, pageSize: PAGE_SIZE });
  let page: Page<Publication> | null = null;
  try {
    page = await load(requested > 0 ? requested : 1);
    // A page past the end (an old link) shows the last page rather than an empty list.
    if (!page.items.length && page.meta.total > 0) {
      page = await load(Math.ceil(page.meta.total / PAGE_SIZE));
    }
  } catch {
    page = null;
  }
  const pageCount = page ? Math.max(1, Math.ceil(page.meta.total / PAGE_SIZE)) : 1;
  const filters = { type, year, pillar };
  const href = (n: number) => {
    const query = new URLSearchParams(
      Object.entries({ ...filters, page: n > 1 ? String(n) : undefined }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    ).toString();
    return `/publications${query ? `?${query}` : ""}`;
  };

  const select = (
    name: string,
    label: string,
    value: string | undefined,
    options: { value: string; label: string }[],
  ) => (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={`pub-${name}`} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={`pub-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className="h-11 rounded-md border bg-white px-3"
      >
        <option value="">{t("any")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <main id="content" className="onn-container py-8">
      <h1>{nav("publications")}</h1>
      <p className="text-muted-foreground mt-2 max-w-prose">{t("intro")}</p>

      <FilterForm
        path="/publications"
        label={t("filters")}
        className="bg-surface-2 mt-6 grid items-end gap-4 rounded-lg p-4 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,16rem))_auto]"
      >
        {select(
          "type",
          t("type"),
          type,
          TYPES.map((value) => ({ value, label: t(`types.${value}`) })),
        )}
        {select(
          "year",
          t("year"),
          year,
          years.map((value) => ({ value, label: value })),
        )}
        {select(
          "pillar",
          t("pillar"),
          pillar,
          usedPillars.map((item) => ({ value: item.code, label: item.name })),
        )}
        <noscript>
          <Button type="submit">{t("apply")}</Button>
        </noscript>
      </FilterForm>

      {!page ? (
        <p role="alert" className="bg-surface-2 mt-6 rounded-lg p-6">
          {t("error")}
        </p>
      ) : (
        <>
          <p role="status" className="mt-6 font-semibold">
            {t("results", { count: page.meta.total })}
          </p>
          {page.items.length ? (
            <ul className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {page.items.map((item) => (
                <li key={item.slug}>
                  <PublicationCard item={item} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="bg-surface-2 mt-4 rounded-lg p-6">
              <p>{t("empty")}</p>
              {(type || year || pillar) && (
                <Link
                  href="/publications"
                  className="text-primary mt-2 inline-block font-semibold underline"
                >
                  {t("clearFilters")}
                </Link>
              )}
            </div>
          )}
          <Pagination
            className="mt-8"
            page={page.meta.page}
            pageCount={pageCount}
            href={href}
            linkAs={Link}
            labels={{
              nav: common("pagination"),
              previous: common("previous"),
              next: common("next"),
              page: common.raw("pageN") as string,
            }}
          />
        </>
      )}
    </main>
  );
}
