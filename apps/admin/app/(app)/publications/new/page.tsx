import { api } from "@onn/api-client";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { PublicationForm } from "@/components/publications/publication-form";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.publications"))("newTitle") };
}

/** New publication: upload the PDF and cover, describe it, then wait for the signature. */
export default async function NewPublicationPage() {
  const locale = await getLocale();
  const t = await getTranslations("Admin.publications");
  const pillars = await api.pillars({ locale });
  return (
    <>
      <Link href="/publications" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{t("newTitle")}</h1>
      <p className="text-muted-foreground mt-1 mb-6 max-w-2xl">{t("newIntro")}</p>
      <PublicationForm
        mode={{ kind: "create" }}
        pillars={pillars.map((pillar) => ({ code: pillar.code, name: pillar.name }))}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
