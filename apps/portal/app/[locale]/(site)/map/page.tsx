import { ApiError, api, serverCache, type RequestContext } from "@onn/api-client";
import type { Indicator } from "@onn/api-client/types";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createLoader, type SearchParams } from "nuqs/server";
import { MapExplorer } from "@/components/map/map-explorer";
import { ClientMessages } from "@/components/shell/client-messages";
import { Link } from "@/i18n/navigation";
import { isSubnational, selectedUnit } from "@/lib/indicator";
import { initialYear } from "@/lib/map";
import { loadMapData } from "@/lib/map-view";
import { getSelectorData } from "@/lib/selector-data";
import { urlParsers } from "@/lib/url-state";

const loadParams = createLoader(urlParsers);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Pages");
  return { title: t("map") };
}

/** The indicator from `i`, else the home page's map indicator, else the first sub-national one. */
async function pickIndicator(code: string | undefined, ctx: RequestContext, locale: string) {
  const fallback = async () => {
    const home = await api.home(ctx).catch(() => undefined);
    const first =
      home?.mapTeaserIndicator ??
      (await getSelectorData(locale)).indicators.find((item) => item.subnational)?.code;
    return first ? api.indicator(ctx, first) : undefined;
  };
  if (!code) return fallback();
  return api.indicator(ctx, code).catch((error: unknown) => {
    // An unknown code falls back; the selector bar tells the visitor with a toast.
    if (error instanceof ApiError && error.status === 404) return fallback();
    throw error;
  });
}

export default async function MapPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const locale = await getLocale();
  const state = await loadParams(searchParams);
  const code = state.i?.[0];
  const ctx: RequestContext = {
    locale,
    next: serverCache("map", ...(code ? [`indicator:${code}`] : [])),
  };
  const t = await getTranslations("Map");
  const indicator: Indicator | undefined = await pickIndicator(code, ctx, locale);

  if (!indicator) {
    return (
      <main id="content" className="onn-container py-8">
        <h1>{(await getTranslations("Pages"))("map")}</h1>
        <p role="alert" className="mt-4">
          {t("noBoundaries")}
        </p>
      </main>
    );
  }

  if (!isSubnational(indicator)) {
    return (
      <main id="content" className="onn-container py-8">
        <h1>{indicator.name}</h1>
        <p className="mt-4 max-w-prose">{t("notSubnational", { indicator: indicator.name })}</p>
        <Link href={`/data/${indicator.code}`} className="text-primary mt-4 inline-block underline">
          {t("openIndicator")}
        </Link>
      </main>
    );
  }

  const data = await loadMapData({
    indicator,
    level: state.l,
    unit: selectedUnit(state.u, indicator),
    ctx,
    locale,
  });

  return (
    <main id="content" className="max-lg:onn-container max-lg:py-4">
      <ClientMessages namespaces={["Map"]}>
        <MapExplorer
          key={indicator.code}
          data={data}
          initialYear={initialYear(data.years, data.values, state.y)}
          focus={state.a}
          layout="overlay"
          heading="h1"
          initialList={state.v === "table"}
        />
      </ClientMessages>
    </main>
  );
}
