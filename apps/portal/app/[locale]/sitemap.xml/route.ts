import { api, serverCache, type RequestContext } from "@onn/api-client";
import { routing } from "@/i18n/routing";
import { ABOUT_NAV, EXPLORE_NAV, PRIMARY_NAV } from "@/lib/nav";
import { siteOrigin } from "@/lib/origin";
import { allPages } from "@/lib/seo";

interface Entry {
  path: string;
  lastmod?: string;
}

const STATIC = [
  "",
  ...new Set([...PRIMARY_NAV, ...EXPLORE_NAV, ...ABOUT_NAV].map((item) => item.href)),
  "/developers",
];

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const day = (value: string) => value.slice(0, 10);

/** One group of URLs; a failing endpoint drops its group, not the whole sitemap. */
async function group(load: () => Promise<Entry[]>) {
  return load().catch(() => [] as Entry[]);
}

/**
 * Sitemap for one locale (brief §9): pages, published indicators, publications, news and
 * dashboards, each with hreflang alternates for every enabled locale. `robots.txt` lists one
 * per locale.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = routing.locales.includes(requested as never) ? requested : routing.defaultLocale;
  const origin = await siteOrigin();
  const ctx = (tag: string): RequestContext => ({ locale, next: serverCache(tag) });

  const groups = await Promise.all([
    group(async () =>
      (await allPages((page) => api.indicators(ctx("indicators"), { page, pageSize: 500 })))
        .filter((item) => item.status === "published")
        .map((item) => ({
          path: `/data/${encodeURIComponent(item.code)}`,
          lastmod: day(item.lastUpdated),
        })),
    ),
    group(async () =>
      (
        await allPages((page) => api.publications(ctx("publications"), { page, pageSize: 100 }))
      ).map((item) => ({
        path: `/publications/${encodeURIComponent(item.slug)}`,
        lastmod: day(item.date),
      })),
    ),
    group(async () =>
      (await allPages((page) => api.news(ctx("news"), { page, pageSize: 100 }))).map((item) => ({
        path: `/news/${encodeURIComponent(item.slug)}`,
        lastmod: day(item.date),
      })),
    ),
    group(async () =>
      (await api.dashboards(ctx("dashboards"))).map((item) => ({
        path: `/dashboards/${encodeURIComponent(item.slug)}`,
      })),
    ),
  ]);

  const entries: Entry[] = [...STATIC.map((path) => ({ path })), ...groups.flat()];
  const url = (target: string, path: string) => escape(`${origin}/${target}${path}`);
  const body = entries
    .map((entry) => {
      const links = [
        ...routing.locales.map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${alt}" href="${url(alt, entry.path)}"/>`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(routing.defaultLocale, entry.path)}"/>`,
      ];
      return [
        "  <url>",
        `    <loc>${url(locale, entry.path)}</loc>`,
        ...(entry.lastmod ? [`    <lastmod>${entry.lastmod}</lastmod>`] : []),
        ...links,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>
`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
