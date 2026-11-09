import { api, serverCache } from "@onn/api-client";
import { country } from "@onn/config";
import { routing } from "@/i18n/routing";
import { pick } from "@/lib/localised";
import { siteOrigin } from "@/lib/origin";

const MEDIA = { CSV: "text/csv", JSON: "application/json" } as Record<string, string>;

/** DCAT catalogue of the open datasets, for data portals that harvest catalogues (brief §5.9). */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  const locale = routing.locales.includes(requested as never) ? requested : routing.defaultLocale;
  const [datasets, origin] = await Promise.all([
    api.datasets({ locale, next: serverCache("datasets") }),
    siteOrigin(),
  ]);
  const page = `${origin}/${locale}/open-data`;
  const catalog = {
    "@context": {
      dcat: "http://www.w3.org/ns/dcat#",
      dct: "http://purl.org/dc/terms/",
      foaf: "http://xmlns.com/foaf/0.1/",
    },
    "@id": `${origin}/${locale}/open-data/catalog.jsonld`,
    "@type": "dcat:Catalog",
    "dct:title": pick(country.observatory.longName, locale),
    "dct:language": locale,
    "dct:publisher": {
      "@type": "foaf:Organization",
      "foaf:name": pick(country.owner.ministry, locale),
    },
    "foaf:homepage": page,
    "dcat:dataset": datasets.map((dataset) => ({
      "@id": `${page}#${dataset.code}`,
      "@type": "dcat:Dataset",
      "dct:identifier": dataset.code,
      "dct:title": dataset.title,
      "dct:description": dataset.description,
      "dct:modified": dataset.lastUpdated,
      "dct:license": dataset.licence,
      "dct:accrualPeriodicity": dataset.updateFrequency,
      "dcat:landingPage": page,
      "dcat:distribution": dataset.formats.map((format) => ({
        "@type": "dcat:Distribution",
        "dct:format": format,
        "dcat:mediaType": MEDIA[format] ?? "application/octet-stream",
        "dcat:downloadURL": `${origin}${dataset.url}?format=${format.toLowerCase()}`,
        "dct:license": dataset.licence,
      })),
    })),
  };
  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      "Content-Type": "application/ld+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
