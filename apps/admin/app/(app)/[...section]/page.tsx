import { getTranslations } from "next-intl/server";
import { SECTIONS } from "@/lib/sections";

/** Holds each section until its Phase 7 batch builds it. The layout refuses sections the role
 * can't reach. */
export default async function SectionPage({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  const t = await getTranslations("Admin");
  const known = SECTIONS.find((item) => item.href === `/${section[0]}`);
  return (
    <>
      <h1 className="text-h1">{known ? t(`section.${known.key}`) : t("comingTitle")}</h1>
      <p className="text-muted-foreground mt-3">{t("comingNext")}</p>
    </>
  );
}
