import { getTranslations } from "next-intl/server";

/** Stands in for a route until its phase builds it, so the shell can be used end to end. */
export async function PlaceholderPage({ title }: { title: string }) {
  const t = await getTranslations("Pages");
  return (
    <main id="content" className="onn-container py-12">
      <h1>{title}</h1>
      <p className="text-muted-foreground mt-3">{t("comingNext")}</p>
    </main>
  );
}
