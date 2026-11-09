// Search engine helpers (brief §9 SEO): sitemap entries and schema.org JSON-LD.
import type { Indicator, Page, Publication } from "@onn/api-client/types";
import { country } from "@onn/config";
import { pick } from "./localised";

/** Licence names the API sends, mapped to the URL schema.org expects. Unknown names pass through. */
const LICENCES: Record<string, string> = {
  "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "ODbL 1.0": "https://opendatacommons.org/licenses/odbl/1-0/",
  "Etalab 2.0": "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
};

export function licenceUrl(name: string) {
  return LICENCES[name.trim()] ?? name;
}

/** Every page of a paged endpoint, for the sitemap. Stops at `limit` pages as a safeguard. */
export async function allPages<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
  limit = 50,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= limit; page++) {
    const result = await fetchPage(page);
    items.push(...result.items);
    if (items.length >= result.meta.total || result.items.length === 0) break;
  }
  return items;
}

const organisation = (name: string) => ({ "@type": "Organization", name });

/**
 * schema.org `Dataset` for an indicator page (brief §9): name, description, temporal and spatial
 * coverage, licence, creator and a CSV distribution of the whole series.
 */
export function datasetJsonLd(indicator: Indicator, locale: string, origin: string) {
  const url = `${origin}/${locale}/data/${encodeURIComponent(indicator.code)}`;
  const csv = `${origin}/api/v1/data?indicator=${encodeURIComponent(indicator.code)}&format=csv`;
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": url,
    url,
    name: indicator.name,
    description: indicator.definition || indicator.shortDefinition,
    identifier: indicator.code,
    keywords: indicator.synonyms,
    inLanguage: indicator.fallback ? country.locales.default : locale,
    isAccessibleForFree: true,
    license: licenceUrl(indicator.licence),
    temporalCoverage: `${indicator.coverage.from}/${indicator.coverage.to}`,
    spatialCoverage: {
      "@type": "Place",
      name: pick(country.name, locale),
      address: { "@type": "PostalAddress", addressCountry: country.iso3 },
    },
    dateModified: indicator.lastUpdated,
    creator: organisation(indicator.source.org),
    publisher: organisation(pick(country.owner.ministry, locale)),
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: csv,
      },
    ],
  };
}

/** schema.org `Report` for a publication page (brief §9). */
export function reportJsonLd(item: Publication, locale: string, origin: string) {
  const url = `${origin}/${locale}/publications/${encodeURIComponent(item.slug)}`;
  const file = item.fileUrl.startsWith("http") ? item.fileUrl : `${origin}${item.fileUrl}`;
  return {
    "@context": "https://schema.org",
    "@type": "Report",
    "@id": url,
    url,
    name: item.title,
    headline: item.title,
    abstract: item.summary,
    datePublished: item.date,
    inLanguage: item.fallback ? country.locales.default : locale,
    author: organisation(pick(country.observatory.longName, locale)),
    publisher: organisation(pick(country.owner.ministry, locale)),
    encoding: { "@type": "MediaObject", encodingFormat: "application/pdf", contentUrl: file },
  };
}

/** JSON for a `<script type="application/ld+json">`, safe against `</script>` in the text. */
export function serialiseJsonLd(data: object) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
