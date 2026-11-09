import { api } from "@onn/api-client";
import { can } from "@onn/api-client/permissions";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewIndicatorForm } from "@/components/indicators/new-indicator-form";
import { requireSession } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.indicators"))("newTitle") };
}

/** New indicator: code, names, pillar and source; the rest is filled in the editor. */
export default async function NewIndicatorPage() {
  const session = await requireSession();
  if (!can(session.roles, "indicator.edit")) notFound();
  const locale = await getLocale();
  const t = await getTranslations("Admin.indicators");
  const pillars = await api.pillars({ locale });
  return (
    <>
      <Link href="/indicators" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <h1 className="text-h1">{t("newTitle")}</h1>
      <p className="text-muted-foreground mt-1 max-w-2xl">{t("newIntro")}</p>
      <NewIndicatorForm
        pillars={pillars.map((pillar) => ({
          code: pillar.code,
          name: pillar.name,
          themes: pillar.themes.map((theme) => ({ code: theme.code, name: theme.name })),
        }))}
        orgs={session.orgs.map((org) => ({ code: org.code, name: org.name }))}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
