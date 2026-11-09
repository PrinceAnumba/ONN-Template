import { getTranslations } from "next-intl/server";
import Link from "next/link";

/** Unknown paths and sections the role can't reach (hidden rather than refused, brief §7). */
export default async function NotFound() {
  const t = await getTranslations("Admin.notFound");
  return (
    <main id="content" tabIndex={-1} className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-h1">{t("title")}</h1>
      <p className="text-muted-foreground mt-2">{t("body")}</p>
      <Link href="/" className="mt-6 inline-block underline">
        {t("home")}
      </Link>
    </main>
  );
}
