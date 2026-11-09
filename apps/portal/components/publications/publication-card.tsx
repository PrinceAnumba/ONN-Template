import type { Publication } from "@onn/api-client/types";
import { BadgeCheckIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatBytes, formatDate } from "@/lib/format";
import { isLite } from "@/lib/lite";
import { FallbackMark } from "@/components/fallback-mark";
import { fallbackLang } from "@/lib/localised";

/** Card in the publications grid: cover, type, title, date, signature badge and download. */
export async function PublicationCard({ item }: { item: Publication }) {
  const [t, locale, lite] = await Promise.all([
    getTranslations("Publications"),
    getLocale(),
    isLite(),
  ]);
  return (
    <article className="bg-card relative flex h-full gap-4 rounded-lg border p-4 transition-shadow duration-(--onn-dur-2) focus-within:shadow-sm hover:shadow-sm">
      {!lite && (
        <Image
          src={item.coverUrl}
          alt=""
          width={96}
          height={128}
          loading="lazy"
          unoptimized
          className="aspect-[3/4] h-auto w-24 shrink-0 self-start rounded-sm border object-cover"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-muted-foreground text-xs font-semibold uppercase">
          {t(`types.${item.type}`)}
        </p>
        <h2 className="text-h4 line-clamp-3" lang={fallbackLang(item)}>
          <Link
            href={`/publications/${item.slug}`}
            className="after:absolute after:inset-0 hover:underline"
          >
            {item.title}
          </Link>
        </h2>
        <FallbackMark item={item} className="self-start" />
        <p className="text-muted-foreground text-sm">
          <time dateTime={item.date}>{formatDate(item.date, locale)}</time>
        </p>
        {item.verified && (
          <p className="text-positive flex items-center gap-1 text-sm font-semibold">
            <BadgeCheckIcon aria-hidden className="size-4" />
            {t("verified")}
          </p>
        )}
        <a
          href={item.fileUrl}
          download
          className="text-primary relative z-10 mt-auto pt-2 text-sm font-semibold underline"
        >
          {t("download", { size: formatBytes(item.fileBytes, locale) })}
        </a>
      </div>
    </article>
  );
}
