import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { allowedSections, SECTIONS } from "@/lib/sections";
import { getSession } from "@/lib/session";

/** Holds each section until Phase 7 builds it, and blocks sections the role can't reach. */
export default async function SectionPage({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  const href = `/${section[0]}`;
  const known = SECTIONS.find((item) => item.href === href);
  if (!known) {
    const t = await getTranslations("Admin");
    return <p className="text-muted-foreground">{t("comingNext")}</p>;
  }
  const session = await getSession();
  if (!allowedSections(session.roles).some((item) => item.href === href)) notFound();

  const t = await getTranslations("Admin");
  return (
    <>
      <h1>{t(`section.${known.key}`)}</h1>
      <p className="text-muted-foreground mt-3">{t("comingNext")}</p>
    </>
  );
}
