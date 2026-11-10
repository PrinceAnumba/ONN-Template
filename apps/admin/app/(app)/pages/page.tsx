import { adminApi } from "@onn/api-client/admin";
import { StatusPill } from "@onn/ui/components/status-pill";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { TableFrame } from "@/components/list";
import { CONTENT_TONE } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { requireSession } from "@/lib/session";

/** Pages (brief §7): the About and legal pages, and the home page modules. */
export default async function PagesPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.pages");
  const forms = await getTranslations("Admin.forms");
  const ctx = { locale, token: session.token };
  const [pages, home] = await Promise.all([adminApi.pages(ctx), adminApi.homeModules(ctx)]);
  const rows = [
    {
      href: "/pages/home",
      title: t("home.title"),
      content: t("home.summary", {
        chips: home.exampleChips.length,
        indicators: home.featuredIndicators.length,
      }),
      status: home.status,
      updated: home.updated,
    },
    ...pages.map((page) => ({
      href: `/pages/${page.slug}`,
      title: page.title,
      content: t("blockCount", { count: page.blockCount }),
      status: page.status,
      updated: page.updated,
    })),
  ];
  return (
    <>
      <h1 className="text-h1">{t("title")}</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl">{t("intro")}</p>
      <div className="mt-6">
        <TableFrame
          label={t("title")}
          columns={(["name", "content", "status", "updated"] as const).map((key) =>
            t(`column.${key}`),
          )}
        >
          {rows.map((row) => (
            <tr key={row.href} className="border-t">
              <th scope="row" className="p-3 text-start font-semibold">
                <Link href={row.href} className="underline">
                  {row.title}
                </Link>
              </th>
              <td className="p-3">{row.content}</td>
              <td className="p-3">
                <StatusPill tone={CONTENT_TONE[row.status]} label={forms(`status.${row.status}`)} />
              </td>
              <td className="p-3 whitespace-nowrap">{formatDate(row.updated, locale, "medium")}</td>
            </tr>
          ))}
        </TableFrame>
      </div>
    </>
  );
}
