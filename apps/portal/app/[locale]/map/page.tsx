import { getTranslations } from "next-intl/server";
import { PlaceholderPage } from "@/components/shell/placeholder-page";

export default async function Page() {
  const t = await getTranslations("Pages");
  return <PlaceholderPage title={t("map")} />;
}
