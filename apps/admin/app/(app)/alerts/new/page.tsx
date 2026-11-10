import { adminApi } from "@onn/api-client/admin";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { AlertForm } from "@/components/alerts/alert-form";
import { pickerData } from "@/lib/picker-data";
import { requireSession } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.alerts"))("newTitle") };
}

/** New alert rule (brief §7). */
export default async function NewAlertPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.alerts");
  const [{ people }, picker] = await Promise.all([
    adminApi.alerts({ locale, token: session.token }),
    pickerData(locale),
  ]);
  return (
    <>
      <Link href="/alerts" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{t("newTitle")}</h1>
      <p className="text-muted-foreground mt-1 mb-6 max-w-2xl">{t("newIntro")}</p>
      <AlertForm people={people} indicators={picker.indicators} />
    </>
  );
}
