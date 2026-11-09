import type { MaybeFallback } from "@onn/api-client/types";
import { FallbackBadge } from "@onn/ui/components/fallback-badge";
import { getLocale, getTranslations } from "next-intl/server";
import { fallbackLang } from "@/lib/localised";

/**
 * "Not yet translated" badge for API content that came back in the default language (brief §9).
 * Pair it with `lang={fallbackLang(item)}` on the element holding that content; the badge keeps
 * the page language itself.
 */
export async function FallbackMark({
  item,
  className,
}: {
  item: MaybeFallback;
  className?: string;
}) {
  if (!fallbackLang(item)) return null;
  const [t, locale] = await Promise.all([getTranslations("Common"), getLocale()]);
  return <FallbackBadge label={t("notTranslated")} lang={locale} className={className} />;
}
