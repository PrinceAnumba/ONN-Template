import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { NewsItem, Page } from "@onn/api-client/types";
import { Pagination } from "@onn/ui/components/pagination";
import { cn } from "@onn/ui/lib/utils";
import { RssIcon } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 10;
const ALL = 500;
const KINDS = ["news", "watch"] as const;

type Params = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => [value ?? ""].flat()[0]?.trim() ?? "";

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("Nav"), getLocale()]);
  return {
    title: t("news"),
    alternates: { types: { "application/rss+xml": `/${locale}/news/rss.xml` } },
  };
}

/** News and technology watch (brief §5.9): kind tabs, tag filter, paginated list, RSS. */
export default async function NewsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const locale = await getLocale();
  const ctx: RequestContext = { locale, next: serverCache("news") };
  const [t, nav, common, params] = await Promise.all([
    getTranslations("News"),
    getTranslations("Nav"),
    getTranslations("Common"),
    searchParams,
  ]);
  const kind = one(params.kind) === "watch" ? "watch" : "news";

  let tags: string[] = [];
  try {
    const all = await api.news(ctx, { kind, pageSize: ALL });
    tags = [...new Set(all.items.flatMap((item) => item.tags))].sort((a, b) =>
      a.localeCompare(b, locale),
    );
  } catch {
    // The list below reports the failure.
  }
  const tag = tags.find((item) => item === one(params.tag));
  const requested = Number.parseInt(one(params.page), 10);

  const load = (n: number) => api.news(ctx, { kind, tag, page: n, pageSize: PAGE_SIZE });
  let page: Page<NewsItem> | null = null;
  try {
    page = await load(requested > 0 ? requested : 1);
    if (!page.items.length && page.meta.total > 0) {
      page = await load(Math.ceil(page.meta.total / PAGE_SIZE));
    }
  } catch {
    page = null;
  }

  const href = (next: { kind?: string; tag?: string; page?: number }) => {
    const query = new URLSearchParams(
      Object.entries({
        kind: next.kind === "watch" ? "watch" : undefined,
        tag: next.tag,
        page: next.page && next.page > 1 ? String(next.page) : undefined,
      }).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return `/news${query ? `?${query}` : ""}`;
  };

  return (
    <main id="content" className="onn-container py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1>{nav("news")}</h1>
        <a
          href={`/${locale}/news/rss.xml`}
          className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
        >
          <RssIcon aria-hidden className="size-5" />
          {t("rss")}
        </a>
      </div>

      <nav aria-label={t("kinds")} className="mt-4 border-b">
        <ul className="-mb-px flex gap-1">
          {KINDS.map((item) => (
            <li key={item}>
              <Link
                href={href({ kind: item })}
                aria-current={item === kind ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 border-transparent px-3 font-semibold",
                  item === kind
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`kind.${item}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tags.length > 0 && (
        <nav aria-label={t("tags")} className="mt-4">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={href({ kind })}
                aria-current={!tag ? "true" : undefined}
                className={cn(
                  "rounded-pill inline-flex min-h-11 items-center border px-4 text-sm font-semibold",
                  !tag ? "bg-foreground border-foreground text-white" : "bg-white",
                )}
              >
                {t("allTags")}
              </Link>
            </li>
            {tags.map((item) => (
              <li key={item}>
                <Link
                  href={href({ kind, tag: item })}
                  aria-current={item === tag ? "true" : undefined}
                  className={cn(
                    "rounded-pill inline-flex min-h-11 items-center border px-4 text-sm font-semibold",
                    item === tag ? "bg-foreground border-foreground text-white" : "bg-white",
                  )}
                >
                  {item}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {!page ? (
        <p role="alert" className="bg-surface-2 mt-6 rounded-lg p-6">
          {t("error")}
        </p>
      ) : (
        <>
          <p role="status" className="sr-only">
            {t("results", { count: page.meta.total })}
          </p>
          {page.items.length ? (
            <ol className="mt-6 flex max-w-3xl flex-col divide-y">
              {page.items.map((item) => (
                <li key={item.slug} className="relative py-5">
                  <p className="text-muted-foreground text-sm">
                    <time dateTime={item.date}>{formatDate(item.date, locale)}</time>
                  </p>
                  <h2 className="text-h4 mt-1">
                    <Link
                      href={`/news/${item.slug}`}
                      className="after:absolute after:inset-0 hover:underline"
                    >
                      {item.title}
                    </Link>
                  </h2>
                  <p className="mt-1">{item.excerpt}</p>
                  {item.tags.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2" aria-label={t("tags")}>
                      {item.tags.map((name) => (
                        <li key={name} className="rounded-pill border px-2 py-0.5 text-xs">
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="bg-surface-2 mt-6 rounded-lg p-6">{t("empty")}</p>
          )}
          <Pagination
            className="mt-8"
            page={page.meta.page}
            pageCount={Math.max(1, Math.ceil(page.meta.total / PAGE_SIZE))}
            href={(n) => href({ kind, tag, page: n })}
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
