import { country } from "@onn/config";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { NewDashboardForm } from "@/components/dashboards/new-dashboard-form";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.dashboards"))("newTitle") };
}

/** New dashboard: a name and an address, then the builder. */
export default async function NewDashboardPage() {
  const t = await getTranslations("Admin.dashboards");
  return (
    <>
      <Link href="/dashboards" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{t("newTitle")}</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl">{t("newIntro")}</p>
      <NewDashboardForm locales={country.locales.enabled} defaultLocale={country.locales.default} />
    </>
  );
}
