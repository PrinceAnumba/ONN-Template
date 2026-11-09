import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { NewReportForm } from "@/components/reports/new-report-form";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.reports"))("newTitle") };
}

/** New report: pick a template and the period it covers. */
export default async function NewReportPage() {
  const t = await getTranslations("Admin.reports");
  return (
    <>
      <Link href="/reports" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{t("newTitle")}</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl">{t("newIntro")}</p>
      <NewReportForm />
    </>
  );
}
