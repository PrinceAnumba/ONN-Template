// pnpm mocks:gen --country=SEN --seed=42
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { countrySchema } from "@onn/config/schema";
import { generateFixtures } from "./fixtures";
import { loadBoundaries } from "./load";

const here = dirname(fileURLToPath(import.meta.url));

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

const iso3 = arg("country", "SEN");
const seed = Number(arg("seed", "42"));
if (!/^[A-Z]{3}$/.test(iso3) || !Number.isInteger(seed)) {
  console.error("Usage: pnpm mocks:gen --country=SEN --seed=42");
  process.exit(1);
}

const configUrl = pathToFileURL(join(here, "..", "config", "countries", `${iso3}.ts`)).href;
const { default: raw } = await import(configUrl);
const fixtures = generateFixtures(countrySchema.parse(raw), seed, loadBoundaries(iso3));

const dir = join(here, "fixtures", iso3);
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, "geo"), { recursive: true });

const { observations, geo, ...rest } = fixtures;
for (const [name, value] of Object.entries(rest)) {
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
}
writeFileSync(
  join(dir, "observations.ndjson"),
  `${observations.map((item) => JSON.stringify(item)).join("\n")}\n`,
);
for (const [level, topology] of Object.entries(geo)) {
  writeFileSync(join(dir, "geo", `${level}.topo.json`), JSON.stringify(topology));
}

console.log(`[mocks] ${iso3}: ${observations.length} observations written (seed ${seed}).`);
