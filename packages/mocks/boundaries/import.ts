// pnpm --filter @onn/mocks boundaries --country=SEN
//
// Downloads stand-in boundaries from geoBoundaries (gbOpen, pinned release), simplifies them and
// writes boundaries/{ISO3}/adm{1,2}.topo.json with the area names used in geography.ts. Run
// pnpm mocks:gen afterwards. These are not official boundaries: replace them with the national
// statistics office's files when they arrive (same output format: one "areas" object whose
// geometries carry `name`, plus `parent` at adm2).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureCollection } from "geojson";
import { quantize } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { GEOGRAPHY } from "../geography";

const RELEASE = "9469f09";
/** Share of points kept; adm1 must stay under the 150 KB budget with room to spare. */
const KEEP = { ADM1: 0.12, ADM2: 0.1 } as const;

/** geoBoundaries spellings that normalising alone doesn't match. */
const ALIASES: Record<string, string> = {
  "medina yoroufoula": "Médina Yoro Foulah",
  tivaoune: "Tivaouane",
  "plaine de mo": "Mô",
  tandjouare: "Tandjoaré",
};

const here = dirname(fileURLToPath(import.meta.url));
const iso3 = process.argv.find((item) => item.startsWith("--country="))?.slice(10) ?? "SEN";
const geography = GEOGRAPHY[iso3];
if (!geography) throw new Error(`No geography for ${iso3} in geography.ts`);

const normalise = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/ region$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const regions = new Map(geography.adm1.map((region) => [normalise(region.name), region.name]));
const departments = new Map<string, { name: string; parent: string }>();
for (const region of geography.adm1) {
  for (const name of region.adm2) {
    const key = normalise(name);
    if (departments.has(key)) throw new Error(`Duplicate adm2 name ${name}`);
    departments.set(key, { name, parent: region.name });
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

const out = join(here, iso3);
mkdirSync(out, { recursive: true });
const sources: Record<string, unknown> = {};

for (const level of ["ADM1", "ADM2"] as const) {
  const meta = await fetchJson<Record<string, string>>(
    `https://www.geoboundaries.org/api/current/gbOpen/${iso3}/${level}/`,
  );
  const url = `https://github.com/wmgeolab/geoBoundaries/raw/${RELEASE}/releaseData/gbOpen/${iso3}/${level}/geoBoundaries-${iso3}-${level}_simplified.geojson`;
  const source = await fetchJson<FeatureCollection>(url);
  const expected = level === "ADM1" ? regions : departments;
  const seen = new Set<string>();

  for (const feature of source.features) {
    const raw = String(feature.properties?.shapeName ?? "");
    const key = normalise(ALIASES[normalise(raw)] ?? raw);
    if (!expected.has(key)) throw new Error(`${level}: "${raw}" isn't in geography.ts`);
    seen.add(key);
    const match = expected.get(key)!;
    feature.properties =
      typeof match === "string" ? { name: match } : { name: match.name, parent: match.parent };
  }
  const missing = [...expected.keys()].filter((key) => !seen.has(key));
  if (missing.length) throw new Error(`${level}: no shape for ${missing.join(", ")}`);

  type Input = Parameters<typeof presimplify>[0];
  const shaped = presimplify(topology({ areas: source }) as unknown as Input);
  const simple = quantize(simplify(shaped, quantile(shaped, 1 - KEEP[level])), 1e5);
  // presimplify stores a weight on every point; quantize keeps only x and y.
  const file = join(out, `${level.toLowerCase()}.topo.json`);
  writeFileSync(file, JSON.stringify(simple));
  sources[level.toLowerCase()] = {
    source: meta.boundarySource,
    year: meta.boundaryYearRepresented,
    license: meta.boundaryLicense,
    url,
  };
  console.log(`[boundaries] ${iso3} ${level}: ${source.features.length} shapes → ${file}`);
}

writeFileSync(
  join(out, "source.json"),
  `${JSON.stringify({ provider: "geoBoundaries", release: RELEASE, official: false, ...sources }, null, 2)}\n`,
);
