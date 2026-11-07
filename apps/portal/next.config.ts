import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

loadEnvConfig(resolve(process.cwd(), "../.."));

const adminOrigin = process.env.ADMIN_ORIGIN ?? "http://localhost:3001";

const config: NextConfig = {
  transpilePackages: ["@onn/config", "@onn/ui"],
  eslint: { ignoreDuringBuilds: true },
  // Multi-zones: the admin app is served under /admin on the same domain.
  async rewrites() {
    return [
      { source: "/admin", destination: `${adminOrigin}/admin` },
      { source: "/admin/:path*", destination: `${adminOrigin}/admin/:path*` },
    ];
  },
};

export default config;
