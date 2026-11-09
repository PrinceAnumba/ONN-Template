import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { NotebookPenIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { formatDate, formatNumber } from "@/lib/format";
import { requireSession } from "@/lib/session";

/** Reports (brief §7): quarterly and annual reports being written. */
export default async function ReportsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.reports");
  const items = await adminApi.reports({ locale, token: session.token });
  const create = (
    <Link
      href="/reports/new"
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
          <EmptyState icon={NotebookPenIcon} message={t("empty")} action={create} />
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
                  {(["name", "template", "period", "blocks", "comments", "updated"] as const).map(
                    (key) => (
                      <th
                        key={key}
                        scope="col"
                        className="p-3 text-start font-semibold whitespace-nowrap"
                      >
                        {t(`column.${key}`)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t align-top">
                    <th scope="row" className="p-3 text-start font-semibold">
                      <Link href={`/reports/${item.id}`} className="underline">
                        {item.title}
                      </Link>
                    </th>
                    <td className="p-3 whitespace-nowrap">{t(`template.${item.template}`)}</td>
                    <td className="p-3 font-mono whitespace-nowrap">{item.period}</td>
                    <td className="p-3 tabular-nums">{formatNumber(item.blockCount, locale)}</td>
                    <td className="p-3 tabular-nums">
                      {item.openComments
                        ? t("openComments", { count: item.openComments })
                        : t("noComments")}
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
