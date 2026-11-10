import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { InboxIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { FeedbackInbox } from "@/components/feedback/feedback-inbox";
import { FILTER_FIELD, listHref, ListPager, TabLinks } from "@/components/list";
import { portalUrl } from "@/lib/content";
import { FEEDBACK_STATUSES } from "@/lib/governance";
import { requireSession } from "@/lib/session";
import { PAGE_SIZES } from "@/lib/submissions";

interface FeedbackProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    rating?: string;
    page?: string;
    size?: string;
  }>;
}

const RATINGS = [5, 4, 3, 2, 1];

/** Feedback inbox (brief §7): what visitors sent from the portal, by status. */
export default async function FeedbackPage({ searchParams }: FeedbackProps) {
  const params = await searchParams;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.feedback");
  const forms = await getTranslations("Admin.forms");
  const common = await getTranslations("Common");
  const status = FEEDBACK_STATUSES.find((item) => item === params.status);
  const rating = RATINGS.find((item) => String(item) === params.rating);
  const pageSize = PAGE_SIZES.find((size) => String(size) === params.size) ?? PAGE_SIZES[0]!;
  const result = await adminApi.feedback(
    { locale, token: session.token },
    {
      q: params.q?.trim() || undefined,
      status,
      rating,
      page: Number(params.page) || 1,
      pageSize,
    },
  );
  const filters = { q: params.q?.trim(), rating };
  const href = (changes: Record<string, string | number | undefined>) =>
    listHref("/feedback", {
      ...filters,
      status,
      size: pageSize === PAGE_SIZES[0] ? undefined : pageSize,
      ...changes,
    });
  const filtered = Boolean(filters.q || rating);
  const total = FEEDBACK_STATUSES.reduce((sum, item) => sum + result.counts[item], 0);

  return (
    <>
      <h1 className="text-h1">{t("title")}</h1>
      <TabLinks
        label={t("tabsLabel")}
        tabs={[
          {
            href: href({ status: undefined, page: undefined }),
            label: forms("all"),
            active: !status,
            count: total,
          },
          ...FEEDBACK_STATUSES.map((item) => ({
            href: href({ status: item, page: undefined }),
            label: t(`status.${item}`),
            active: status === item,
            count: result.counts[item],
          })),
        ]}
      />
      <form action="/admin/feedback" method="get" className="mt-6 flex flex-wrap items-end gap-3">
        {status && <input type="hidden" name="status" value={status} />}
        <div>
          <label htmlFor="feedback-q" className="mb-1 block font-semibold">
            {t("filter.search")}
          </label>
          <input
            id="feedback-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            className={`${FILTER_FIELD} w-64 max-w-full`}
          />
        </div>
        <div>
          <label htmlFor="feedback-rating" className="mb-1 block font-semibold">
            {t("filter.rating")}
          </label>
          <select
            id="feedback-rating"
            name="rating"
            defaultValue={rating ?? ""}
            className={FILTER_FIELD}
          >
            <option value="">{forms("all")}</option>
            {RATINGS.map((item) => (
              <option key={item} value={item}>
                {t("rating", { rating: item })}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-11 rounded-md px-4 font-semibold"
        >
          {common("apply")}
        </button>
        {filtered && (
          <Link
            href={listHref("/feedback", { status })}
            className="inline-flex h-11 items-center underline"
          >
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
            icon={InboxIcon}
            message={t(filtered || status ? "emptyFiltered" : "empty")}
          />
        ) : (
          <FeedbackInbox
            items={result.items}
            portal={portalUrl("")}
            emptyLabel={t("emptyFiltered")}
          />
        )}
      </div>
      <ListPager meta={result.meta} href={({ page, size }) => href({ page, size })} />
    </>
  );
}
