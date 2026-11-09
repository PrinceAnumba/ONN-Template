import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

loadEnvConfig(resolve(process.cwd(), "../.."));

// The locale list for the precache, from the generated config (written before every build).
const { locales, brand } = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../packages/config/generated/country.json"), "utf8"),
) as { locales: { enabled: string[] }; brand: { logo: string; favicon: string } };
const revision = randomUUID();

/**
 * Offline (brief §8). Precache only the shell: the two Source Sans files, brand files, and each
 * locale's home and offline pages. CSS and JS are cached as pages use them (the first page's
 * files through a CACHE_URLS message once the worker is ready), so a first visit never downloads
 * MapLibre, KaTeX or Scalar. Off in development, where a worker would serve stale code.
 */
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development",
  include: [/\.woff2$/],
  exclude: [/KaTeX/],
  globPublicPatterns: [],
  additionalPrecacheEntries: [
    { url: brand.logo, revision },
    { url: brand.favicon, revision },
    ...locales.enabled.flatMap((locale) => [
      { url: `/${locale}`, revision },
      { url: `/${locale}/offline`, revision },
    ]),
  ],
});

const adminOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";
const apiOrigin =
  process.env.NEXT_PUBLIC_API_BASE || process.env.MOCK_API_ORIGIN || "http://localhost:4000";

const config: NextConfig = {
  transpilePackages: ["@onn/api-client", "@onn/charts", "@onn/config", "@onn/ui"],
  // Without this the radix-ui barrel adds 80 KB to any page importing a shadcn component.
  experimental: { optimizePackageImports: ["radix-ui"] },
  eslint: { ignoreDuringBuilds: true },
  // Multi-zones: the admin app is served under /admin on the same domain.
  async rewrites() {
    return [
      { source: "/admin", destination: `${adminOrigin}/admin` },
      { source: "/admin/:path*", destination: `${adminOrigin}/admin/:path*` },
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` },
      { source: "/geo/:path*", destination: `${apiOrigin}/geo/:path*` },
    ];
  },
};

/**
 * @serwist/next always adds its window client (`window.serwist`, about 2 KB) to every page, even
 * with `register: false`. The app registers the worker itself from a lazy chunk
 * (`components/shell/offline-worker.ts`), so drop that entry to keep it out of the budgets.
 */
function withoutSerwistClient(next: NextConfig): NextConfig {
  const webpack = next.webpack;
  return {
    ...next,
    webpack(webpackConfig, options) {
      const result = webpack ? webpack(webpackConfig, options) : webpackConfig;
      const entry = result.entry;
      if (typeof entry !== "function") return result;
      result.entry = async () => {
        const entries = await entry();
        for (const key of ["main.js", "main-app"]) {
          if (Array.isArray(entries[key])) {
            entries[key] = entries[key].filter(
              (file: string) => !/[\\/]@serwist[\\/]next[\\/]dist[\\/]sw-entry\.mjs$/.test(file),
            );
          }
        }
        return entries;
      };
      return result;
    },
  };
}

export default withoutSerwistClient(withSerwist(createNextIntlPlugin("./i18n/request.ts")(config)));
