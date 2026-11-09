import { api, ApiError } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { can } from "@onn/api-client/permissions";
import { country } from "@onn/config";
import { StatusPill } from "@onn/ui/components/status-pill";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IndicatorEditor } from "@/components/indicators/indicator-editor";
import { formatDate } from "@/lib/format";
import { EDITOR_TABS, INDICATOR_TONE } from "@/lib/indicators";
import { requireSession } from "@/lib/session";

interface IndicatorProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: IndicatorProps) {
  return { title: decodeURIComponent((await params).code) };
}

/** Indicator editor (brief §7 Indicators): tabs, then save as a new version with a note. */
export default async function IndicatorPage({ params, searchParams }: IndicatorProps) {
  const code = decodeURIComponent((await params).code);
  const requested = (await searchParams).tab;
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.indicators");
  const [indicator, pillars] = await Promise.all([
    adminApi.indicator({ locale, token: session.token }, code).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
    api.pillars({ locale }),
  ]);
  const name = indicator.name[locale] || indicator.name[country.locales.default] || indicator.code;

  return (
    <>
      <Link href="/indicators" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1">{name}</h1>
        <StatusPill
          tone={INDICATOR_TONE[indicator.status]}
          label={t(`status.${indicator.status}`)}
        />
      </div>
      <p className="text-muted-foreground mt-1">
        {t("meta", {
          code: indicator.code,
          version: indicator.version,
          date: formatDate(indicator.updated, locale, "medium"),
        })}
      </p>
      <IndicatorEditor
        initial={indicator}
        pillars={pillars.map((pillar) => ({
          code: pillar.code,
          name: pillar.name,
          themes: pillar.themes.map((theme) => ({ code: theme.code, name: theme.name })),
        }))}
        orgs={session.orgs.map((org) => ({ code: org.code, name: org.name }))}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
        geoLevels={[
          { key: "national", label: t("national") },
          ...country.geography.levels.map((level) => ({
            key: level.key,
            label:
              (level.label as Record<string, string>)[locale] ??
              (level.label as Record<string, string>)[country.locales.default] ??
              level.key,
          })),
        ]}
        canEdit={can(session.roles, "indicator.edit")}
        initialTab={EDITOR_TABS.find((tab) => tab === requested) ?? "general"}
      />
    </>
  );
}
