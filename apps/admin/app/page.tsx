import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("Admin");
  return (
    <>
      <h1>{t("section.dashboard")}</h1>
      <p className="text-muted-foreground mt-3">{t("comingNext")}</p>
    </>
  );
}
