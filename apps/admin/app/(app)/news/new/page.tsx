import { country } from "@onn/config";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { NewsEditor } from "@/components/news/news-editor";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.news"))("newTitle") };
}

/** New article: saved as a draft, then published or scheduled from its page. */
export default async function NewNewsPage() {
  const t = await getTranslations("Admin.news");
  return (
    <>
      <Link href="/news" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <NewsEditor locales={country.locales.enabled} defaultLocale={country.locales.default} />
    </>
  );
}
