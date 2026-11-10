import { adminApi } from "@onn/api-client/admin";
import { EmptyState } from "@onn/ui/components/empty-state";
import { Building2Icon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { TableFrame } from "@/components/list";
import { formatNumber } from "@/lib/format";
import { requireSession } from "@/lib/session";

/** Organisations (brief §7): who supplies data, with what they report and how. */
export default async function OrganisationsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.organisations");
  const orgs = await adminApi.organisations({ locale, token: session.token });
  return (
    <>
      <h1 className="text-h1">{t("title")}</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl">{t("intro")}</p>
      <p role="status" className="text-muted-foreground mt-6">
        {t("count", { count: orgs.length })}
      </p>
      <div className="mt-2">
        {orgs.length === 0 ? (
          <EmptyState icon={Building2Icon} message={t("empty")} />
        ) : (
          <TableFrame
            label={t("title")}
            columns={(
              ["name", "kind", "indicators", "connectors", "users", "contact"] as const
            ).map((key) => t(`column.${key}`))}
          >
            {orgs.map((org) => (
              <tr key={org.code} className="border-t align-top">
                <th scope="row" className="min-w-56 p-3 text-start font-semibold">
                  <Link href={`/organisations/${org.code}`} className="underline">
                    {org.name}
                  </Link>
                </th>
                <td className="p-3 whitespace-nowrap">{t(`kind.${org.kind}`)}</td>
                <td className="p-3 tabular-nums">{formatNumber(org.indicators, locale)}</td>
                <td className="p-3 tabular-nums">{formatNumber(org.connectors, locale)}</td>
                <td className="p-3 tabular-nums">{formatNumber(org.users, locale)}</td>
                <td className="min-w-40 p-3">{org.contact ?? t("noContact")}</td>
              </tr>
            ))}
          </TableFrame>
        )}
      </div>
    </>
  );
}
