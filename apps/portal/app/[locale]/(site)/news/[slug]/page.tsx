import { ApiError, api, serverCache } from "@onn/api-client";
import type { NewsItem } from "@onn/api-client/types";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Link } from "@/i18n/navigation";
import { RichText } from "@/components/cms/cms-blocks";
import { formatDate } from "@/lib/format";
import { siteOrigin } from "@/lib/origin";

const RELATED = 3;
const ALL = 500;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getItem = cache(async (slug: string, locale: string) =>
  api.newsItem({ locale, next: serverCache(`news:${slug}`) }, slug).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }),
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getItem(slug, await getLocale());
  return { title: item.title, description: item.excerpt };
}

/** Share targets that need no script or SDK, only a link. */
function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const text = encodeURIComponent(title);
  return [
    { key: "email", href: `mailto:?subject=${text}&body=${u}` },
    { key: "linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { key: "x", href: `https://x.com/intent/post?url=${u}&text=${text}` },
    { key: "whatsapp", href: `https://wa.me/?text=${text}%20${u}` },
    { key: "facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ] as const;
}

/** Same tags first, then the latest of the same kind. */
function related(item: NewsItem, all: NewsItem[]) {
  const others = all.filter((other) => other.slug !== item.slug);
  const shared = others.filter((other) => other.tags.some((tag) => item.tags.includes(tag)));
  const rest = others.filter((other) => !shared.includes(other) && other.kind === item.kind);
  return [...shared, ...rest].slice(0, RELATED);
}

/** News or watch item (brief §5.9): hero, body, source, share links and related items. */
export default async function NewsItemPage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const [item, t, origin] = await Promise.all([
    getItem(slug, locale),
    getTranslations("News"),
    siteOrigin(),
  ]);
  const all = await api
    .news({ locale, next: serverCache("news") }, { pageSize: ALL })
    .then((page) => page.items)
    .catch(() => [] as NewsItem[]);
  const url = `${origin}/${locale}/news/${item.slug}`;
  const more = related(item, all);
  const back = item.kind === "watch" ? "/news?kind=watch" : "/news";

  return (
    <main id="content" className="onn-container py-8">
      <Link
        href={back}
        className="text-primary inline-flex min-h-11 items-center gap-1 font-semibold underline"
      >
        <ArrowLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
        {t(`back.${item.kind}`)}
      </Link>
      <article className="mt-4 max-w-3xl">
        <p className="text-muted-foreground text-sm font-semibold uppercase">
          {t(`kind.${item.kind}`)}
        </p>
        <h1 className="mt-1">{item.title}</h1>
        <p className="text-muted-foreground mt-2">
          <time dateTime={item.date}>{formatDate(item.date, locale)}</time>
        </p>
        {item.imageUrl && (
          <Image
            src={item.imageUrl}
            alt=""
            width={1200}
            height={630}
            priority
            unoptimized
            className="mt-6 h-auto w-full rounded-lg border"
          />
        )}
        <RichText source={item.body} className="mt-6" />
        {item.sourceUrl && (
          <p className="mt-6">
            <a
              href={item.sourceUrl}
              rel="noopener"
              target="_blank"
              className="text-primary inline-flex min-h-11 items-center gap-2 font-semibold underline"
            >
              <ExternalLinkIcon aria-hidden className="size-4" />
              {t("source")}
              <span className="sr-only">{t("newTab")}</span>
            </a>
          </p>
        )}
        {item.tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2" aria-label={t("tags")}>
            {item.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/news?${new URLSearchParams({ ...(item.kind === "watch" ? { kind: "watch" } : {}), tag })}`}
                  className="rounded-pill inline-flex min-h-11 items-center border px-4 text-sm hover:underline"
                >
                  {tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <section aria-labelledby="share" className="mt-8 border-t pt-6">
          <h2 id="share" className="text-h4">
            {t("share")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {shareLinks(url, item.title).map((link) => (
              <li key={link.key}>
                <a
                  href={link.href}
                  rel="noopener"
                  target={link.key === "email" ? undefined : "_blank"}
                  className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold hover:underline"
                >
                  {t(`shareOn.${link.key}`)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </article>

      {more.length > 0 && (
        <section aria-labelledby="related" className="mt-12 border-t pt-8">
          <h2 id="related">{t("related")}</h2>
          <ul className="mt-4 grid gap-6 md:grid-cols-3">
            {more.map((other) => (
              <li key={other.slug} className="relative rounded-lg border p-4 hover:shadow-sm">
                <p className="text-muted-foreground text-sm">
                  <time dateTime={other.date}>{formatDate(other.date, locale)}</time>
                </p>
                <h3 className="text-h4 mt-1">
                  <Link
                    href={`/news/${other.slug}`}
                    className="after:absolute after:inset-0 hover:underline"
                  >
                    {other.title}
                  </Link>
                </h3>
                <p className="mt-1 text-sm">{other.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
