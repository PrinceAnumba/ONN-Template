import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <main id="content" className="onn-container py-16">
      <h1>{t("title")}</h1>
      <p className="mt-3">{t("body")}</p>
    </main>
  );
}
