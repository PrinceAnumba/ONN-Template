import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

loadEnvConfig(resolve(process.cwd(), "../.."));

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

export default createNextIntlPlugin("./i18n/request.ts")(config);
