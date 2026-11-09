import { api, ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicationDetail } from "@/components/publications/publication-detail";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.publications");
  return { title: t("detailTitle", { slug: (await params).slug }) };
}

/** One publication: signature status, file, publishing and metadata (brief §7). */
export default async function PublicationPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.publications");
  const [item, pillars] = await Promise.all([
    adminApi.publication({ locale, token: session.token }, slug).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    api.pillars({ locale }),
  ]);
  return (
    <>
      <Link href="/publications" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <PublicationDetail
        initial={item}
        pillars={pillars.map((pillar) => ({ code: pillar.code, name: pillar.name }))}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
