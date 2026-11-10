import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageEditor } from "@/components/pages/page-editor";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.pages");
  return { title: t("detailTitle", { slug: (await params).slug }) };
}

/** Block editor for one CMS page (brief §7). */
export default async function CmsPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.pages");
  const page = await adminApi
    .page({ locale, token: session.token }, slug)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
  return (
    <>
      <Link href="/pages" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <PageEditor
        initial={page}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
