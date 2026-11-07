// Validates the active country and writes everything derived from it. Runs before any app builds.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { countrySchema } from "./schema";
import { renderTokensCss } from "./tokens";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const envFile = join(root, ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

function fail(message: string): never {
  console.error(`\n[config] ${message}\n`);
  process.exit(1);
}

const iso3 = process.env.NEXT_PUBLIC_COUNTRY || "SEN";
const countryFile = join(here, "countries", `${iso3}.ts`);
if (!existsSync(countryFile)) {
  fail(`No config for NEXT_PUBLIC_COUNTRY=${iso3}: expected packages/config/countries/${iso3}.ts`);
}

const { default: raw } = await import(pathToFileURL(countryFile).href);
const parsed = countrySchema.safeParse(raw);
if (!parsed.success) fail(`Invalid config for ${iso3}:\n${z.prettifyError(parsed.error)}`);
const config = parsed.data;
if (config.iso3 !== iso3) fail(`${iso3}.ts declares iso3 "${config.iso3}"`);

mkdirSync(join(here, "generated"), { recursive: true });
writeFileSync(join(here, "generated", "country.json"), JSON.stringify(config, null, 2));

const { css, inkAdjusted, ink } = renderTokensCss(config.brand);
writeFileSync(join(root, "packages", "ui", "tokens.css"), css);
if (inkAdjusted) {
  console.warn(
    `[config] Warning: brand.primary ${config.brand.primary} is under 4.5:1 on white; --onn-primary-ink darkened to ${ink}.`,
  );
}

for (const app of readdirSync(join(root, "apps"))) {
  const target = join(root, "apps", app, "public", "brand");
  cpSync(join(here, "assets", iso3), target, { recursive: true });
}

console.log(`[config] ${iso3} validated; tokens and brand assets written.`);
