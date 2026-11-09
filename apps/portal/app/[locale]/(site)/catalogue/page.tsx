import { api, serverCache, type RequestContext } from "@onn/api-client";
import type { Indicator, IndicatorSummary, Pillar } from "@onn/api-client/types";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CatalogueView } from "@/components/catalogue/catalogue-view";
import { ClientMessages } from "@/components/shell/client-messages";
import { parseCatalogue, type CatalogueRow, type Facet } from "@/lib/catalogue";
import { formatDate } from "@/lib/format";
import { isSubnational } from "@/lib/indicator";
import { metadataProps } from "@/lib/metadata";

const PERIODICITIES = ["monthly", "quarterly", "annual", "biennial"] as const;
const STATUSES = ["published", "in_collection", "planned"] as const;
const ALL = 500;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nav");
  return { title: t("catalogue") };
}

/** Indicator catalogue (brief §5.8): every indicator, whatever its status. */
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const ctx: RequestContext = { locale, next: serverCache("catalogue") };
  const [t, nav, ind] = await Promise.all([
    getTranslations("Catalogue"),
    getTranslations("Nav"),
    getTranslations("Indicator"),
  ]);

  let pillars: Pillar[] = [];
  let indicators: IndicatorSummary[] = [];
  let failed = false;
  try {
    [pillars, indicators] = await Promise.all([
      api.pillars(ctx),
      api.indicators(ctx, { pageSize: ALL }).then((page) => page.items),
    ]);
  } catch {
    failed = true;
  }

  // Indicators without a page open a read-only metadata drawer, so their metadata ships with it.
  const unpublished = indicators.filter((item) => item.status !== "published");
  const [full, metadata] = await Promise.all([
    Promise.all(unpublished.map((item) => api.indicator(ctx, item.code).catch(() => null))),
    metadataProps(),
  ]);
  const details = Object.fromEntries(
    full
      .filter((item): item is Indicator => item !== null)
      .map((indicator) => [indicator.code, { indicator, display: metadata.display(indicator) }]),
  );

  const rows: CatalogueRow[] = indicators.map((item) => ({
    code: item.code,
    name: item.name,
    synonyms: item.synonyms,
    pillar: item.pillar,
    unit: item.unit,
    periodicity: item.periodicity,
    source: item.source.org,
    intl: item.intlRefs.map((ref) => `${ref.org}: ${ref.code}`).join("; "),
    sub: isSubnational(item) ? "yes" : "no",
    updated: item.lastUpdated,
    updatedLabel: formatDate(item.lastUpdated, locale),
    status: item.status,
  }));

  const sources = [...new Set(rows.map((row) => row.source))].sort((a, b) =>
    a.localeCompare(b, locale),
  );
  const names: Record<Facet, Record<string, string>> = {
    pillar: Object.fromEntries(
      [...pillars].sort((a, b) => a.order - b.order).map((pillar) => [pillar.code, pillar.name]),
    ),
    source: Object.fromEntries(sources.map((source) => [source, source])),
    periodicity: Object.fromEntries(
      PERIODICITIES.filter((value) => rows.some((row) => row.periodicity === value)).map(
        (value) => [value, ind(`periodicity.${value}`)],
      ),
    ),
    status: Object.fromEntries(STATUSES.map((value) => [value, t(`status.${value}`)])),
    sub: { yes: t("sub.yes"), no: t("sub.no") },
  };

  return (
    <main id="content" className="onn-container py-8">
      <h1>{nav("catalogue")}</h1>
      <p className="text-muted-foreground mt-2 max-w-prose">{t("intro")}</p>
      {failed ? (
        <p role="alert" className="bg-surface-2 mt-6 rounded-lg p-6">
          {t("error")}
        </p>
      ) : (
        <ClientMessages namespaces={["Catalogue"]}>
          <CatalogueView
            rows={rows}
            initial={parseCatalogue(await searchParams)}
            names={names}
            details={details}
            metadataLabels={metadata.labels}
            exportLabels={{
              preparing: t("exportPreparing"),
              ready: t("exportReady"),
              failed: t("exportFailed"),
            }}
          />
        </ClientMessages>
      )}
    </main>
  );
}
