import { serverCache } from "@onn/api-client";
import { decodePreview } from "@onn/api-client/preview";
import { country } from "@onn/config";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { SearchParams } from "nuqs/server";
import { WidgetView } from "@/components/dashboard/widget-view";
import { EmbedHeight } from "@/components/embed/embed-height";
import { buildWidgets } from "@/lib/dashboard";
import { tagFor } from "@/lib/format";
import { getSelectorData } from "@/lib/selector-data";

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export const metadata: Metadata = { robots: { index: false } };

/**
 * `/embed/preview?d=…`: draft dashboard widgets from the back office (brief §7 "live preview
 * using portal components"), rendered exactly as a published dashboard renders them. The widgets
 * come from the URL, so nothing unpublished is fetched; `decodePreview` validates them.
 */
export default async function EmbedPreview({ searchParams }: PageProps) {
  const params = await searchParams;
  const widgets = decodePreview(typeof params.d === "string" ? params.d : null);
  if (!widgets) notFound();
  const locale = await getLocale();
  const selector = await getSelectorData(locale);
  const models = await buildWidgets(widgets, {
    ctx: { locale, next: serverCache("dashboards") },
    locale,
    focus: country.iso3,
    comparison: null,
    areaNames: new Map(selector.areas.map((area) => [area.code, area.name])),
  });
  const tag = tagFor(locale);
  return (
    <main id="content" className="p-3">
      <div className="grid gap-4 md:grid-cols-3">
        {models.map((model) => (
          <WidgetView key={model.id} model={model} tag={tag} />
        ))}
      </div>
      <EmbedHeight />
    </main>
  );
}
