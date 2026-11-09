import { Button } from "@onn/ui/components/ui/button";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Offline");
  return { title: t("title"), robots: { index: false } };
}

/**
 * Precached by the service worker and served for a page that was never saved (brief §8). Pages
 * already visited open from the cache instead, under the offline banner.
 */
export default async function OfflinePage() {
  const t = await getTranslations("Offline");
  return (
    <main id="content" className="onn-container py-16">
      <h1>{t("title")}</h1>
      <p className="mt-3 max-w-prose">{t("body")}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
