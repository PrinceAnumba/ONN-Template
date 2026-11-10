import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { cn } from "@onn/ui/lib/utils";
import { NewspaperIcon, RadarIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  FILTER_FIELD,
  listHref,
  ListPager,
  PrimaryLink,
  TabLinks,
  TableFrame,
} from "@/components/list";
import { WatchQueue } from "@/components/news/watch-queue";
import { WatchSettingsForm } from "@/components/news/watch-settings";
import { NEWS_STATUSES, NEWS_TONE, WATCH_STATUSES } from "@/lib/editorial";
import { formatDate, formatTime } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

interface NewsProps {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    status?: string;
    kind?: string;
    page?: string;
    size?: string;
  }>;
}

/** News and watch (brief §7): the articles, and the queue of collected stories. */
export default async function NewsPage({ searchParams }: NewsProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.news");
  const forms = await getTranslations("Admin.forms");
  const common = await getTranslations("Common");
  const ctx = { locale, token: session.token };
  const watching = params.tab === "watch";
  const watchStatus = WATCH_STATUSES.find((item) => item === params.status) ?? "pending";
  const create = <PrimaryLink href="/news/new">{t("new")}</PrimaryLink>;

  const status = NEWS_STATUSES.find((item) => item === params.status);
  const kind = params.kind === "news" || params.kind === "watch" ? params.kind : undefined;
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  // Both tabs show how many stories are waiting, so the queue is always fetched.
  const [queue, result] = await Promise.all([
    adminApi.watchQueue(ctx, watching ? watchStatus : "pending"),
    watching
      ? null
      : adminApi.news(ctx, {
          q: params.q?.trim() || undefined,
          status,
          kind,
          page: Number(params.page) || 1,
          pageSize,
        }),
  ]);
  const href = (changes: Record<string, string | number | undefined>) =>
    listHref("/news", {
      q: params.q?.trim(),
      status,
      kind,
      size: pageSize === PAGE_SIZES[0] ? undefined : pageSize,
      ...changes,
    });
  const filtered = Boolean(params.q?.trim() || status || kind);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {create}
      </div>
      <TabLinks
        label={t("tabsLabel")}
        tabs={[
          { href: "/news", label: t("tab.articles"), active: !watching },
          {
            href: "/news?tab=watch",
            label: t("tab.watch"),
            active: watching,
            count: queue.counts.pending,
          },
        ]}
      />

      {result && (
        <>
          <form action="/admin/news" method="get" className="mt-6 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="news-q" className="mb-1 block font-semibold">
                {t("filter.search")}
              </label>
              <input
                id="news-q"
                name="q"
                type="search"
                defaultValue={params.q ?? ""}
                className={`${FILTER_FIELD} w-64 max-w-full`}
              />
            </div>
            <div>
              <label htmlFor="news-status" className="mb-1 block font-semibold">
                {t("filter.status")}
              </label>
              <select
                id="news-status"
                name="status"
                defaultValue={status ?? ""}
                className={FILTER_FIELD}
              >
                <option value="">{forms("all")}</option>
                {NEWS_STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {t(`status.${item}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="news-kind" className="mb-1 block font-semibold">
                {t("filter.kind")}
              </label>
              <select id="news-kind" name="kind" defaultValue={kind ?? ""} className={FILTER_FIELD}>
                <option value="">{forms("all")}</option>
                <option value="news">{t("kind.news")}</option>
                <option value="watch">{t("kind.watch")}</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
            >
              {common("apply")}
            </button>
            {filtered && (
              <Link href="/news" className="inline-flex h-11 items-center underline">
                {forms("clearFilters")}
              </Link>
            )}
          </form>
          <p role="status" className="text-muted-foreground mt-4">
            {t("count", { count: result.meta.total })}
          </p>
          <div className="mt-2">
            {result.items.length === 0 ? (
              <EmptyState
                icon={NewspaperIcon}
                message={t(filtered ? "emptyFiltered" : "empty")}
                action={create}
              />
            ) : (
              <TableFrame
                label={t("tab.articles")}
                columns={(["name", "kind", "status", "date", "tags", "updated"] as const).map(
                  (key) => t(`column.${key}`),
                )}
              >
                {result.items.map((item) => (
                  <tr key={item.slug} className="border-t align-top">
                    <th scope="row" className="min-w-56 p-3 text-start font-semibold">
                      <Link href={`/news/${item.slug}`} className="underline">
                        {item.title}
                      </Link>
                    </th>
                    <td className="p-3 whitespace-nowrap">{t(`kind.${item.kind}`)}</td>
                    <td className="p-3">
                      <StatusPill
                        tone={NEWS_TONE[item.status]}
                        label={t(`status.${item.status}`)}
                      />
                      {item.publishAt && (
                        <span className="mt-1 block text-xs whitespace-nowrap">
                          {forms("dateTime", {
                            date: formatDate(item.publishAt, locale, "medium"),
                            time: formatTime(item.publishAt, locale),
                          })}
                        </span>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.date, locale, "medium")}
                    </td>
                    <td className="p-3">{item.tags.join(", ")}</td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.updated, locale, "medium")}
                    </td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </div>
          <ListPager meta={result.meta} href={({ page, size }) => href({ page, size })} />
        </>
      )}

      {watching && (
        <>
          <p className="text-muted-foreground mt-4 max-w-2xl">{t("watch.intro")}</p>
          <nav aria-label={t("watch.statusLabel")} className="mt-4">
            <ul className="flex flex-wrap gap-2">
              {WATCH_STATUSES.map((item) => (
                <li key={item}>
                  <Link
                    href={listHref("/news", {
                      tab: "watch",
                      status: item === "pending" ? undefined : item,
                    })}
                    aria-current={item === watchStatus ? "page" : undefined}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-md border px-4 font-semibold",
                      item === watchStatus
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background",
                    )}
                  >
                    {t(`watch.status.${item}`, { count: queue.counts[item] })}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-4">
            {queue.items.length === 0 ? (
              <EmptyState icon={RadarIcon} message={t(`watch.empty.${watchStatus}`)} />
            ) : (
              <WatchQueue items={queue.items} />
            )}
          </div>
          <section aria-labelledby="watch-settings" className="mt-10">
            <h2 id="watch-settings" className="text-h2">
              {t("watch.settings.title")}
            </h2>
            <p className="text-muted-foreground mt-1 mb-4 max-w-2xl">{t("watch.settings.intro")}</p>
            <WatchSettingsForm initial={queue.settings} />
          </section>
        </>
      )}
    </>
  );
}
