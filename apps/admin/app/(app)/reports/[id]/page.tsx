import { ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportBuilder } from "@/components/reports/report-builder";
import { pickerData } from "@/lib/picker-data";
import { requireSession } from "@/lib/session";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const t = await getTranslations("Admin.reports");
  return { title: t("builderTitle", { id: (await params).id }) };
}

/** Report builder (brief §7). */
export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.reports");
  const [report, picker] = await Promise.all([
    adminApi.report({ locale, token: session.token }, id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    pickerData(locale),
  ]);
  return (
    <>
      <Link href="/reports" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <ReportBuilder initial={report} picker={picker} />
    </>
  );
}
