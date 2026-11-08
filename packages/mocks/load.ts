import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Boundaries, Fixtures } from "./fixtures";

const here = dirname(fileURLToPath(import.meta.url));

/** Boundary files from boundaries/{ISO3} (written by boundaries/import.ts), if the country has them. */
export function loadBoundaries(iso3: string): Boundaries {
  const dir = join(here, "boundaries", iso3);
  const levels = ["adm1", "adm2"] as const;
  return Object.fromEntries(
    levels
      .filter((level) => existsSync(join(dir, `${level}.topo.json`)))
      .map((level) => [level, JSON.parse(readFileSync(join(dir, `${level}.topo.json`), "utf8"))]),
  );
}

export function loadFixtures(iso3: string): Fixtures {
  const dir = join(here, "fixtures", iso3);
  if (!existsSync(dir)) {
    throw new Error(`No fixtures for ${iso3}: run pnpm mocks:gen --country=${iso3} --seed=42`);
  }
  const json = (name: string) => JSON.parse(readFileSync(join(dir, name), "utf8"));
  const data: Record<string, unknown> = {};
  for (const file of readdirSync(dir)) {
    if (file.endsWith(".json")) data[file.replace(".json", "")] = json(file);
  }
  data.observations = readFileSync(join(dir, "observations.ndjson"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  data.geo = Object.fromEntries(
    readdirSync(join(dir, "geo")).map((file) => [
      file.replace(".topo.json", ""),
      json(join("geo", file)),
    ]),
  );
  return data as unknown as Fixtures;
}
