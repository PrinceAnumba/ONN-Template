import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

loadEnvConfig(resolve(process.cwd(), "../.."));

const apiOrigin =
  process.env.NEXT_PUBLIC_API_BASE || process.env.MOCK_API_ORIGIN || "http://localhost:4000";

const config: NextConfig = {
  basePath: "/admin",
  transpilePackages: ["@onn/api-client", "@onn/config", "@onn/ui"],
  // Without this the radix-ui barrel adds 80 KB to any page importing a shadcn component.
  experimental: { optimizePackageImports: ["radix-ui"] },
  eslint: { ignoreDuringBuilds: true },
  // Reachable outside /admin, so the same client paths work on either port.
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*`, basePath: false },
      { source: "/geo/:path*", destination: `${apiOrigin}/geo/:path*`, basePath: false },
    ];
  },
};

export default config;
