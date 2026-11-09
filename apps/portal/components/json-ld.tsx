import { serialiseJsonLd } from "@/lib/seo";

/** schema.org structured data for search engines (brief §9). */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Serialised with `<` escaped, so the text can't close the script element.
      dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
    />
  );
}
