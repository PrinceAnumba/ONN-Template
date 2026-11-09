import { country } from "@onn/config";
import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/origin";

/**
 * robots.txt (brief §9): keeps crawlers out of the admin zone, chart embeds and the offline page,
 * and lists one sitemap per locale.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  const locales = country.locales.enabled;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        ...locales.flatMap((locale) => [`/${locale}/embed/`, `/${locale}/offline`]),
      ],
    },
    sitemap: locales.map((locale) => `${origin}/${locale}/sitemap.xml`),
  };
}
