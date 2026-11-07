import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

loadEnvConfig(resolve(process.cwd(), "../.."));

const config: NextConfig = {
  basePath: "/admin",
  transpilePackages: ["@onn/config", "@onn/ui"],
  eslint: { ignoreDuringBuilds: true },
};

export default config;
