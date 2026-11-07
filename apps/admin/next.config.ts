import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

loadEnvConfig(resolve(process.cwd(), "../.."));

const config: NextConfig = {
  basePath: "/admin",
  transpilePackages: ["@onn/config", "@onn/ui"],
  // Without this the radix-ui barrel adds 80 KB to any page importing a shadcn component.
  experimental: { optimizePackageImports: ["radix-ui"] },
  eslint: { ignoreDuringBuilds: true },
};

export default config;
