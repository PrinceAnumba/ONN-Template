import { ApiError, api, serverCache } from "@onn/api-client";
import { country } from "@onn/config";
import { Button } from "@onn/ui/components/ui/button";
import { ArrowLeftIcon, BadgeCheckIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Link } from "@/i18n/navigation";
import { Citation } from "@/components/publications/citation";
import { formatBytes, formatDate } from "@/lib/format";
import { pick } from "@/lib/localised";
import { isLite } from "@/lib/lite";
import { siteOrigin } from "@/lib/origin";
import { FallbackMark } from "@/components/fallback-mark";
import { fallbackLang } from "@/lib/localised";
import { JsonLd } from "@/components/json-ld";
import { reportJsonLd } from "@/lib/seo";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getPublication = cache(async (slug: string, locale: string) =>
  api
    .publication({ locale, next: serverCache(`publication:${slug}`) }, slug)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await getPublication(slug, await getLocale());
  return { title: item.title, description: item.summary };
}

/** Publication detail (brief §5.9): cover, summary, signature badge, PDF preview and citation. */
export default async function PublicationPage({ params }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const [item, t, origin, lite] = await Promise.all([
    getPublication(slug, locale),
    getTranslations("Publications"),
    siteOrigin(),
    isLite(),
  ]);
  const citation = t("citationText", {
    publisher: pick(country.owner.ministry, locale),
    year: item.date.slice(0, 4),
    title: item.title,
    site: pick(country.observatory.longName, locale),
    url: `${origin}/${locale}/publications/${item.slug}`,
  });
  const date = formatDate(item.date, locale);

  return (
    <main id="content" className="onn-container py-8">
      <JsonLd data={reportJsonLd(item, locale, origin)} />
      <Link
        href="/publications"
        className="text-primary inline-flex min-h-11 items-center gap-1 font-semibold underline"
      >
        <ArrowLeftIcon aria-hidden className="size-4 rtl:rotate-180" />
        {t("back")}
      </Link>

      <div
        className={
          lite
            ? "mt-4"
            : "mt-4 grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]"
        }
      >
        {!lite && (
          <Image
            src={item.coverUrl}
            alt=""
            width={300}
            height={400}
            priority
            unoptimized
            className="aspect-[3/4] h-auto w-40 rounded-sm border object-cover md:w-full"
          />
        )}
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm font-semibold uppercase">
            {t(`types.${item.type}`)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 lang={fallbackLang(item)}>{item.title}</h1>
            <FallbackMark item={item} />
          </div>
          <p className="text-muted-foreground mt-2">
            <time dateTime={item.date}>{t("published", { date })}</time>
          </p>
          {item.verified && (
            <p className="rounded-pill border-positive text-positive mt-3 inline-flex items-center gap-1.5 border-2 px-3 py-1 text-sm font-semibold">
              <BadgeCheckIcon aria-hidden className="size-4" />
              {t("verified")}
              <span className="sr-only">{t("verifiedHint")}</span>
            </p>
          )}
          <p className="mt-4 max-w-prose">{item.summary}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <a href={item.fileUrl} download>
                <DownloadIcon aria-hidden />
                {t("download", { size: formatBytes(item.fileBytes, locale) })}
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href={item.fileUrl} target="_blank" rel="noopener">
                <ExternalLinkIcon aria-hidden />
                {t("openPdf")}
              </a>
            </Button>
          </div>

          <section aria-labelledby="citation" className="mt-8">
            <h2 id="citation" className="text-h3">
              {t("citation")}
            </h2>
            <div className="mt-3">
              <Citation
                text={citation}
                labels={{
                  copy: t("copyCitation"),
                  copied: t("copied"),
                  failed: t("copyFailed"),
                }}
              />
            </div>
          </section>
        </div>
      </div>

      {/* Phones get the "Open PDF" button instead: inline PDF viewers are unreliable there. */}
      <section aria-labelledby="preview" className="mt-10 hidden md:block">
        <h2 id="preview" className="text-h3">
          {t("preview")}
        </h2>
        <iframe
          src={item.fileUrl}
          title={t("previewTitle", { title: item.title })}
          loading="lazy"
          className="mt-3 h-[80vh] w-full rounded-lg border"
        />
      </section>
    </main>
  );
}
