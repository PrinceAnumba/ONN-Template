import { country } from "@onn/config";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { ChartView } from "@/components/indicator/sections";
import { loadIndicatorView } from "@/lib/indicator-view";
import { serializeUrlState } from "@/lib/url-state";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = { robots: { index: false } };

/**
 * `/embed/chart?i=…` (minimal definition, see CLAUDE.md): one indicator chart with the same URL
 * state as the indicator page, no header or footer, and a link back to the full page.
 */
export default async function EmbedChart({ searchParams }: PageProps) {
  const params = await searchParams;
  const code = String(params.i ?? "").split(",")[0];
  if (!code) notFound();
  const locale = await getLocale();
  const view = await loadIndicatorView(code, Promise.resolve(params), locale);
  const t = await getTranslations("Indicator");
  const query = serializeUrlState({
    a: view.state.a,
    c: view.state.c,
    y: view.state.y,
    d: view.state.d,
    u: view.state.u,
  });
  return (
    <main id="content" className="p-3">
      <ChartView view={view} />
      <a
        href={`/${locale}/data/${view.indicator.code}${query}`}
        target="_top"
        className="text-primary mt-2 inline-block text-sm underline"
      >
        {t("viewOnSite", { site: country.observatory.shortName })}
      </a>
    </main>
  );
}
