import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampaignComposer } from "@/components/newsletter/campaign-composer";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.newsletter");
  return { title: t("detailTitle", { id: (await params).id }) };
}

/** One newsletter: a draft to compose and send, or a past send with its rates (brief §7). */
export default async function CampaignPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.newsletter");
  const ctx = { locale, token: session.token };
  const [campaign, options] = await Promise.all([
    adminApi.campaign(ctx, id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    adminApi.campaignOptions(ctx),
  ]);
  return (
    <>
      <Link href="/newsletter" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <CampaignComposer
        initial={campaign}
        options={options}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
