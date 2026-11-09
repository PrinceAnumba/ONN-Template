import { adminApi } from "@onn/api-client/admin";
import { ApiError } from "@onn/api-client";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardBuilder } from "@/components/dashboards/dashboard-builder";
import { pickerData } from "@/lib/picker-data";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.dashboards");
  return { title: t("builderTitle", { slug: (await params).slug }) };
}

/** Dashboard builder (brief §7). */
export default async function DashboardBuilderPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.dashboards");
  const [dashboard, picker] = await Promise.all([
    adminApi.dashboard({ locale, token: session.token }, slug).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    pickerData(locale),
  ]);
  return (
    <>
      <Link href="/dashboards" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <DashboardBuilder
        initial={dashboard}
        picker={picker}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
