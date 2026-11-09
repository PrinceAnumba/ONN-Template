import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { StatusPill } from "@onn/ui/components/status-pill";
import { FileTextIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { SIGNATURE_TONE } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

/** Publications (brief §7): uploaded PDFs with their signature and portal status. */
export default async function PublicationsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.publications");
  const items = await adminApi.publications({ locale, token: session.token });
  const create = (
    <Link
      href="/publications/new"
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
          <EmptyState icon={FileTextIcon} message={t("empty")} action={create} />
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
                  {(["name", "type", "period", "date", "signature", "portal"] as const).map(
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
                  <tr key={item.slug} className="border-t align-top">
                    <th scope="row" className="p-3 text-start font-semibold">
                      <Link href={`/publications/${item.slug}`} className="underline">
                        {item.title}
                      </Link>
                    </th>
                    <td className="p-3 whitespace-nowrap">{t(`type.${item.type}`)}</td>
                    <td className="p-3 font-mono whitespace-nowrap">{item.period}</td>
                    <td className="p-3 whitespace-nowrap">
                      {formatDate(item.date, locale, "medium")}
                    </td>
                    <td className="p-3">
                      <StatusPill
                        tone={SIGNATURE_TONE[item.signature]}
                        label={t(`signature.${item.signature}`)}
                      />
                    </td>
                    <td className="p-3">
                      <StatusPill
                        tone={item.published ? "positive" : "neutral"}
                        label={item.published ? t("published") : t("notPublished")}
                      />
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
