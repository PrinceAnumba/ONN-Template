import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { LayoutDashboardIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CONTENT_TONE } from "@/lib/content";
import { formatDate, formatNumber } from "@/lib/format";
import { requireSession } from "@/lib/session";

/** Dashboards (brief §7): each portal dashboard with its publication state. */
export default async function DashboardsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.dashboards");
  const items = await adminApi.dashboards({ locale, token: session.token });
  const create = (
    <Link
      href="/dashboards/new"
      className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-md px-4 font-semibold"
    >
      {t("new")}
    </Link>
  );
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-h1">{t("title")}</h1>
        {create}
      </div>
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState icon={LayoutDashboardIcon} message={t("empty")} action={create} />
        ) : (
          <div
            className="relative overflow-x-auto rounded-lg border"
            role="region"
            aria-label={t("title")}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable table region
            tabIndex={0}
          >
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-surface-2">
                <tr>
                  {(["name", "audience", "widgets", "status", "updated"] as const).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="p-3 text-start font-semibold whitespace-nowrap"
                    >
                      {t(`column.${key}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.slug} className="border-t align-top">
                    <th scope="row" className="p-3 text-start font-semibold">
                      <Link href={`/dashboards/${item.slug}`} className="underline">
                        {item.title}
                      </Link>
                      <span className="text-muted-foreground block font-mono text-xs font-normal">
                        {item.slug}
                      </span>
                    </th>
                    <td className="p-3">{t(`audience.${item.audience}`)}</td>
                    <td className="p-3 tabular-nums">{formatNumber(item.widgetCount, locale)}</td>
                    <td className="p-3">
                      <StatusPill
                        tone={CONTENT_TONE[item.status]}
                        label={t(`status.${item.status}`)}
                      />
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.updated, locale, "medium")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
