import { ApiError, api, serverCache } from "@onn/api-client";
import { country } from "@onn/config";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createLoader, type SearchParams } from "nuqs/server";
import { ExportMenu } from "@/components/dashboard/export-menu";
import { PresentButton } from "@/components/dashboard/present-button";
import { WidgetView } from "@/components/dashboard/widget-view";
import { buildWidgets } from "@/lib/dashboard";
import { tagFor } from "@/lib/format";
import { getSelectorData } from "@/lib/selector-data";
import { urlParsers } from "@/lib/url-state";
import { FallbackMark } from "@/components/fallback-mark";
import { fallbackLang } from "@/lib/localised";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}

const loadParams = createLoader({ a: urlParsers.a, c: urlParsers.c });

async function getDashboard(slug: string, locale: string) {
  return api
    .dashboard({ locale, next: serverCache(`dashboard:${slug}`, "dashboards") }, slug)
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const dashboard = await getDashboard(slug, await getLocale());
  return { title: dashboard.title, description: dashboard.description };
}

/** Dashboard detail (brief §5.5): widgets in a 3-column grid, Present and Export. */
export default async function DashboardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const tag = tagFor(locale);
  const [dashboard, state, selector, t, home] = await Promise.all([
    getDashboard(slug, locale),
    loadParams(searchParams),
    getSelectorData(locale),
    getTranslations("Dashboard"),
    getTranslations("Home"),
  ]);
  const areaNames = new Map(selector.areas.map((area) => [area.code, area.name]));
  const known = (code: string | null) => (code && areaNames.has(code) ? code : null);
  const models = await buildWidgets(dashboard.widgets, {
    ctx: { locale, next: serverCache(`dashboard:${slug}`, "dashboards") },
    locale,
    focus: known(state.a) ?? country.iso3,
    comparison: known(state.c),
    areaNames,
  });
  // Slides skip widgets with nothing to show, and leave out the CSV tables they don't use.
  const slides = models
    .filter((model) => model.body.kind !== "error" && model.body.kind !== "empty")
    .map((model) => ({ ...model, table: undefined }));

  return (
    <main id="content" className="onn-container py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-prose">
          <span className="rounded-pill text-muted-foreground border px-2 text-xs">
            {home(`audience.${dashboard.audience}`)}
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 lang={fallbackLang(dashboard)}>{dashboard.title}</h1>
            <FallbackMark item={dashboard} />
          </div>
          <p lang={fallbackLang(dashboard)} className="text-muted-foreground mt-2">
            {dashboard.description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PresentButton
            slides={slides}
            logo={country.brand.logo}
            tag={tag}
            label={t("present")}
            labels={{
              dialog: t("presentation", { title: dashboard.title }),
              previous: t("previous"),
              next: t("next"),
              exit: t("exit"),
              count: t.raw("slideCount") as string,
              announcement: t.raw("slideAnnouncement") as string,
              keys: t("keys"),
            }}
          />
          <ExportMenu
            resource="dashboard"
            params={{ slug }}
            formats={[
              { format: "pdf", label: t("pdf") },
              { format: "pptx", label: t("pptx") },
            ]}
            labels={{
              export: t("export"),
              preparing: t("preparing"),
              ready: t("exportReady"),
              failed: t("exportFailed"),
            }}
          />
        </div>
      </header>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {models.map((model) => (
          <WidgetView key={model.id} model={model} tag={tag} />
        ))}
      </div>
    </main>
  );
}
