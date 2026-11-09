import { api, serverCache } from "@onn/api-client";
import { country } from "@onn/config";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pick } from "@/lib/localised";
import { siteOrigin } from "@/lib/origin";

const ITEMS = 20;

const escape = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c,
  );

/** RSS 2.0 feed of news and technology watch, newest first (brief §5.9 "RSS link"). */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = routing.locales.includes(requested as never) ? requested : routing.defaultLocale;
  const [t, nav, origin] = await Promise.all([
    getTranslations({ locale, namespace: "News" }),
    getTranslations({ locale, namespace: "Nav" }),
    siteOrigin(),
  ]);
  const page = await api.news({ locale, next: serverCache("news") }, { pageSize: ITEMS });
  const site = pick(country.observatory.longName, locale);
  const items = page.items
    .map((item) => {
      const link = `${origin}/${locale}/news/${item.slug}`;
      return `    <item>
      <title>${escape(item.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(`${item.date}T00:00:00Z`).toUTCString()}</pubDate>
      <category>${escape(t(`kind.${item.kind}`))}</category>
${item.tags.map((tag) => `      <category>${escape(tag)}</category>`).join("\n")}
      <description>${escape(item.excerpt)}</description>
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${nav("news")} · ${site}`)}</title>
    <link>${origin}/${locale}/news</link>
    <atom:link href="${origin}/${locale}/news/rss.xml" rel="self" type="application/rss+xml"/>
    <description>${escape(t("feedDescription", { site }))}</description>
    <language>${locale}</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
