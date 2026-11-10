import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsEditor } from "@/components/news/news-editor";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.news");
  return { title: t("detailTitle", { slug: (await params).slug }) };
}

/** One article or watch item: text per language, picture, tags and publishing (brief §7). */
export default async function NewsItemPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.news");
  const item = await adminApi
    .newsItem({ locale, token: session.token }, slug)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  return (
    <>
      <Link href="/news" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <NewsEditor
        initial={item}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
