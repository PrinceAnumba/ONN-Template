import type { CountryConfig } from "@onn/config";
import type {
  Area,
  Benchmark,
  CmsBlock,
  Dashboard,
  Dataset,
  Indicator,
  NewsItem,
  Observation,
  ObsStatus,
  Publication,
  Widget,
} from "@onn/api-client/types";
import {
  DIM_FACTORS,
  DIM_VALUES,
  INDICATORS,
  PILLARS,
  UNITS,
  type IndicatorSeed,
  type L,
} from "./catalog";
import { ECONOMIES, GEOGRAPHY } from "./geography";

export const FIRST_YEAR = 2015;
export const LAST_YEAR = 2025;
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
const GENERATED_ON = "2026-10-15";
const SOURCE_ORG: Record<string, L> = {
  survey: { fr: "Enquête nationale TIC", en: "National ICT survey" },
  administrative: { fr: "Autorité de régulation", en: "Regulatory authority" },
  computed: { fr: "Observatoire national du numérique", en: "National Digital Observatory" },
  international: { fr: "UIT", en: "ITU" },
};

/** Replaces each string in T with per-locale text, as stored in fixtures. */
type Localised<T> = T extends string
  ? T | L
  : T extends (infer U)[]
    ? Localised<U>[]
    : T extends object
      ? { [K in keyof T]: Localised<T[K]> }
      : T;

export interface PeerFixture {
  economies: Record<string, L>;
  members: Record<string, string[]>;
  groupNames: Record<string, L>;
  /** indicator → economy → year → value */
  values: Record<string, Record<string, Record<string, number | null>>>;
  retrievedAt: Benchmark["retrievedAt"];
}

export interface Fixtures {
  meta: { iso3: string; locales: string[]; defaultLocale: string; defaultPeerGroup: string };
  pillars: {
    code: string;
    icon: string;
    order: number;
    name: L;
    description: L;
    themes: { code: string; name: L }[];
  }[];
  indicators: Localised<Omit<Indicator, "latest" | "indicatorCount">>[];
  /** Multipliers for `unit` variants, by indicator and variant code. */
  unitFactors: Record<string, Record<string, number>>;
  areas: Localised<Area>[];
  observations: Observation[];
  peers: PeerFixture;
  dashboards: Localised<Dashboard>[];
  publications: Localised<Publication>[];
  news: Localised<NewsItem>[];
  home: Record<string, unknown>;
  targets: {
    name: L;
    targets: { indicator: string; name: L; unit: L; target: number; targetYear: string }[];
  };
  index: { year: string; score: number; pillars: { code: string; name: L; score: number }[] }[];
  pages: Localised<{ slug: string; title: string; blocks: CmsBlock[] }>[];
  datasets: Localised<Dataset>[];
  geo: Record<string, unknown>;
}

/** Mulberry32: small, seedable and stable across platforms. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, unit: string) {
  if (unit === "count" || unit === "xof" || unit === "hhi") return Math.round(value);
  return Math.round(value * 10) / 10;
}

function periods(seed: IndicatorSeed) {
  if (seed.periodicity === "biennial")
    return YEARS.filter((y) => (LAST_YEAR - y) % 2 === 0).map(String);
  if (seed.periodicity === "quarterly") {
    return YEARS.flatMap((y) => [1, 2, 3, 4].map((q) => `${y}-Q${q}`));
  }
  return YEARS.map(String);
}

function buildAreas(config: CountryConfig): Localised<Area>[] {
  const geography = GEOGRAPHY[config.iso3];
  if (!geography) throw new Error(`No geography for ${config.iso3}`);
  const areas: Localised<Area>[] = [
    { code: config.iso3, level: "country", name: config.name, iso3: config.iso3 },
  ];
  geography.adm1.forEach((region, i) => {
    const code = `${geography.iso2}-${String(i + 1).padStart(2, "0")}`;
    areas.push({ code, level: "adm1", name: region.name, parent: config.iso3 });
    region.adm2.forEach((department, j) => {
      areas.push({
        code: `${code}-${String(j + 1).padStart(2, "0")}`,
        level: "adm2",
        name: department,
        parent: code,
      });
    });
  });
  return areas;
}

/** Monotonic base trend with a little seeded variation in its curve and end point. */
function baseTrend(seed: IndicatorSeed, count: number, random: () => number, scale: number) {
  const curve = 0.8 + random() * 0.5;
  const end = seed.start + (seed.end - seed.start) * (0.94 + random() * 0.12);
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 1 : i / (count - 1);
    return (seed.start + (end - seed.start) * t ** curve) * scale;
  });
}

function buildObservations(config: CountryConfig, areas: Fixtures["areas"], random: () => number) {
  const geography = GEOGRAPHY[config.iso3];
  if (!geography) throw new Error(`No geography for ${config.iso3}`);
  const observations: Observation[] = [];
  const urbanity = new Map<string, number>();
  geography.adm1.forEach((region, i) => {
    urbanity.set(`${geography.iso2}-${String(i + 1).padStart(2, "0")}`, region.urbanity);
  });

  for (const seed of INDICATORS) {
    if (seed.status === "planned") continue;
    const source = SOURCE_ORG[seed.method]?.fr ?? "";
    const unitLabel = UNITS[seed.unit]?.fr ?? seed.unit;
    const periodList = periods(seed);
    const trend = baseTrend(seed, periodList.length, random, ECONOMIES[config.iso3]?.maturity ?? 1);
    const breakAt = random() < 0.2 ? Math.floor(periodList.length * 0.5) : -1;
    const gapAt = random() < 0.25 ? 1 + Math.floor(random() * (periodList.length - 3)) : -1;
    const estimateAt = random() < 0.4 ? Math.floor(periodList.length * 0.3) : -1;
    const lastIsProvisional = random() < 0.5;

    const push = (
      area: string,
      dims: Record<string, string>,
      scale: number,
      withFlags: boolean,
    ) => {
      periodList.forEach((period, i) => {
        const value = Math.min((trend[i] as number) * scale, seed.max ?? Infinity);
        let status: ObsStatus = "A";
        if (withFlags && i === breakAt) status = "B";
        if (withFlags && i === estimateAt) status = "E";
        if (withFlags && lastIsProvisional && i === periodList.length - 1) status = "P";
        const missing = i === gapAt;
        observations.push({
          indicator: seed.code,
          area,
          period,
          dims,
          value: missing ? null : round(value, seed.unit),
          unit: unitLabel,
          status: missing ? "M" : status,
          source,
          version: 1,
        });
      });
    };

    push(config.iso3, {}, 1, true);
    for (const area of areas) {
      const code = area.code as string;
      if (area.level === "adm1" && seed.geoLevels.includes("adm1")) {
        const scale = (urbanity.get(code) ?? 1) * (0.97 + random() * 0.06);
        push(code, {}, scale, false);
      }
      if (area.level === "adm2" && seed.geoLevels.includes("adm2")) {
        const parent = urbanity.get(area.parent as string) ?? 1;
        push(code, {}, parent * (0.9 + random() * 0.18), false);
      }
    }
    for (const key of seed.disaggregations) {
      for (const value of DIM_VALUES[key] ?? []) {
        push(config.iso3, { [key]: value }, DIM_FACTORS[value] ?? 1, false);
      }
    }
  }
  return observations;
}

/** Latest period of a series is the last annual value; quarterly peers use Q4. */
function buildPeers(config: CountryConfig, random: () => number): PeerFixture {
  const members = new Set(Object.values(config.peers.groups).flatMap((group) => group.members));
  const economies: Record<string, L> = {};
  const values: PeerFixture["values"] = {};
  for (const iso3 of members) {
    const economy = ECONOMIES[iso3];
    if (economy) economies[iso3] = { fr: economy.fr, en: economy.en };
  }
  for (const seed of INDICATORS.filter((item) => item.isHeadline && item.status === "published")) {
    const perEconomy: Record<string, Record<string, number | null>> = {};
    for (const iso3 of Object.keys(economies)) {
      const maturity = ECONOMIES[iso3]?.maturity ?? 1;
      const scale = seed.higherIsBetter ? maturity : 1 / maturity;
      const trend = baseTrend(seed, YEARS.length, random, scale);
      const gap = random() < 0.1 ? LAST_YEAR : -1;
      perEconomy[iso3] = Object.fromEntries(
        YEARS.map((year, i) => [
          String(year),
          year === gap
            ? null
            : round(Math.min(trend[i] as number, seed.max ?? Infinity), seed.unit),
        ]),
      );
    }
    values[seed.code] = perEconomy;
  }
  const groups = Object.entries(config.peers.groups).map(([code, group]) => [code, group.members]);
  const groupNames = Object.fromEntries(
    Object.entries(config.peers.groups).map(([code, group]) => [code, group.name]),
  );
  return {
    economies,
    members: Object.fromEntries(groups),
    groupNames,
    values,
    retrievedAt: GENERATED_ON,
  };
}

function buildIndicators(areaCount: number, dashboards: Fixtures["dashboards"]) {
  return INDICATORS.map((seed, index) => {
    const siblings = INDICATORS.filter((i) => i.theme === seed.theme && i.code !== seed.code);
    const label = UNITS[seed.unit] ?? { fr: seed.unit, en: seed.unit };
    const hasData = seed.status !== "planned";
    return {
      code: seed.code,
      name: seed.name,
      shortDefinition: seed.shortDefinition,
      synonyms: seed.synonyms,
      pillar: seed.pillar,
      theme: seed.theme,
      unit: label,
      unitVariants: [
        { code: seed.unit, label },
        ...(seed.countVariant
          ? [{ code: "people", label: { fr: "personnes", en: "people" } as string | L }]
          : []),
      ],
      periodicity: seed.periodicity,
      geoLevels: seed.geoLevels,
      disaggregations: seed.disaggregations,
      higherIsBetter: seed.higherIsBetter,
      isHeadline: seed.isHeadline,
      status: seed.status,
      lastUpdated: GENERATED_ON,
      source: { org: SOURCE_ORG[seed.method] ?? "", method: seed.method },
      intlRefs: seed.itu
        ? [
            {
              org: "ITU" as const,
              code: seed.itu,
              name: seed.name,
              url: "https://datahub.itu.int/",
            },
          ]
        : [],
      definition: {
        fr: `${seed.shortDefinition.fr} Les valeurs de cette démonstration sont synthétiques.`,
        en: `${seed.shortDefinition.en} Values in this demo are synthetic.`,
      },
      computation:
        seed.unit === "pct"
          ? {
              fr: "$$\\text{valeur} = 100 \\times \\frac{N}{P}$$",
              en: "$$\\text{value} = 100 \\times \\frac{N}{P}$$",
            }
          : undefined,
      coverage: {
        from: String(FIRST_YEAR),
        to: String(LAST_YEAR),
        areas: hasData ? 1 + (seed.geoLevels.length > 1 ? areaCount - 1 : 0) : 0,
      },
      qualityNotes:
        seed.method === "survey"
          ? { fr: "Marge d'erreur de ±2 points.", en: "Margin of error of ±2 points." }
          : undefined,
      // Spread over the next year so the release calendar has something to show.
      nextRelease:
        seed.status === "published"
          ? `${index % 12 < 2 ? 2026 : 2027}-${String(((index + 10) % 12) + 1).padStart(2, "0")}`
          : undefined,
      versions: [
        {
          version: 1,
          date: GENERATED_ON,
          note: { fr: "Publication initiale", en: "First release" },
        },
      ],
      licence: "CC BY 4.0",
      related: siblings.slice(0, 4).map((item) => item.code),
      dashboards: dashboards
        .filter((dashboard) => dashboard.widgets.some((w) => w.indicators.includes(seed.code)))
        .map((dashboard) => ({ slug: dashboard.slug as string, title: dashboard.title })),
    };
  });
}

function buildDashboards(config: CountryConfig): Fixtures["dashboards"] {
  const widget = (
    id: string,
    type: Widget["type"],
    title: L,
    indicators: string[],
    span: Widget["span"],
    extra: Localised<Partial<Widget>> = {},
  ) => ({ id, type, title, indicators, span, ...extra });
  const peer = `peer:${config.peers.default}`;
  return [
    {
      slug: "decision-makers",
      title: { fr: "Tableau de bord des décideurs", en: "Decision-makers dashboard" },
      description: {
        fr: "Les indicateurs clés pour le pilotage de la stratégie numérique.",
        en: "The key indicators for steering the digital strategy.",
      },
      audience: "decision",
      widgets: [
        widget(
          "users",
          "kpi",
          { fr: "Utilisateurs d'Internet", en: "Internet users" },
          ["ACCESS.INTERNET_USERS"],
          1,
        ),
        widget("coverage", "kpi", { fr: "Couverture 4G", en: "4G coverage" }, ["CONN.4G_POP"], 1),
        widget("price", "kpi", { fr: "Coût de 2 Go", en: "Cost of 2 GB" }, ["AFFORD.DATA_2GB"], 1),
        widget(
          "trend",
          "line",
          { fr: "Évolution des usages", en: "Use over time" },
          ["ACCESS.INTERNET_USERS"],
          2,
          { compare: peer },
        ),
        widget(
          "index",
          "radar",
          { fr: "Score par pilier", en: "Score by pillar" },
          ["ECON.INDEX"],
          1,
        ),
        widget(
          "map",
          "map",
          { fr: "Couverture par région", en: "Coverage by region" },
          ["CONN.4G_POP"],
          3,
        ),
      ],
    },
    {
      slug: "analysts",
      title: { fr: "Tableau de bord des analystes", en: "Analysts dashboard" },
      description: {
        fr: "Marchés, prix et ventilations détaillées.",
        en: "Markets, prices and detailed breakdowns.",
      },
      audience: "analyst",
      widgets: [
        widget(
          "bb",
          "line",
          { fr: "Haut débit", en: "Broadband" },
          ["MARKET.MOBILE_BB", "MARKET.FIXED_BB"],
          2,
        ),
        widget(
          "share",
          "donut",
          { fr: "Parts de marché", en: "Market shares" },
          ["MARKET.MOBILE_SUBS"],
          1,
          { dims: { operator: "*" } },
        ),
        widget(
          "gender",
          "bar",
          { fr: "Écart entre les sexes", en: "Gender gap" },
          ["ACCESS.INTERNET_USERS"],
          1,
          { dims: { sex: "*" } },
        ),
        widget(
          "market",
          "treemap",
          { fr: "Abonnements par opérateur", en: "Subscriptions by operator" },
          ["MARKET.MOBILE_BB"],
          2,
          { dims: { operator: "*" } },
        ),
        widget(
          "table",
          "table",
          { fr: "Détail régional", en: "Regional detail" },
          ["ACCESS.HH_INTERNET"],
          3,
        ),
      ],
    },
    {
      slug: "public",
      title: { fr: "Le numérique en bref", en: "Digital at a glance" },
      description: {
        fr: "Une vue simple de la situation du numérique.",
        en: "A simple view of the state of digital.",
      },
      audience: "public",
      widgets: [
        widget("intro", "text", { fr: "À propos", en: "About" }, [], 3, {
          body: {
            fr: "Ce tableau de bord présente des données de démonstration.",
            en: "This dashboard shows demo data.",
          },
        }),
        widget(
          "target",
          "target",
          { fr: "Objectif de couverture", en: "Coverage target" },
          ["CONN.4G_POP"],
          1,
        ),
        widget(
          "stack",
          "stacked",
          { fr: "Usages par âge", en: "Use by age" },
          ["ACCESS.SMARTPHONE"],
          2,
          { dims: { age_group: "*" } },
        ),
      ],
    },
  ];
}

function buildPublications(random: () => number): Fixtures["publications"] {
  const types = ["quarterly", "annual", "study", "method"] as const;
  const titles: Record<(typeof types)[number], L> = {
    quarterly: { fr: "Tableau de bord trimestriel", en: "Quarterly dashboard" },
    annual: { fr: "Rapport annuel du numérique", en: "Annual digital report" },
    study: { fr: "Étude sur les usages", en: "Study on digital use" },
    method: { fr: "Note méthodologique", en: "Methodology note" },
  };
  return Array.from({ length: 16 }, (_, i) => {
    const type = types[i % types.length] as (typeof types)[number];
    const year = LAST_YEAR - Math.floor(i / 4);
    const slug = `${type}-${year}-${i + 1}`;
    return {
      slug,
      type,
      title: { fr: `${titles[type].fr} ${year}`, en: `${titles[type].en} ${year}` },
      summary: {
        fr: "Une publication de démonstration, sans données réelles.",
        en: "A demo publication with no real data.",
      },
      date: `${year}-${String(1 + ((i * 3) % 12)).padStart(2, "0")}-15`,
      pillar: PILLARS[i % PILLARS.length]?.code,
      coverUrl: `/api/v1/publications/${slug}/cover.svg`,
      fileUrl: `/api/v1/publications/${slug}/file.pdf`,
      fileBytes: 400_000 + Math.floor(random() * 4_000_000),
      verified: i % 3 !== 2,
    };
  });
}

function buildNews(random: () => number): Fixtures["news"] {
  const topics = ["5G", "IA", "cybersécurité", "fibre", "inclusion"];
  return Array.from({ length: 18 }, (_, i) => {
    const kind = i % 3 === 2 ? ("watch" as const) : ("news" as const);
    const topic = topics[i % topics.length] as string;
    const month = String(12 - (i % 12)).padStart(2, "0");
    return {
      slug: `${kind}-${i + 1}`,
      title: { fr: `Actualité de démonstration : ${topic}`, en: `Demo news item: ${topic}` },
      excerpt: { fr: "Un texte de démonstration.", en: "A piece of demo text." },
      body: {
        fr: `Ce contenu de démonstration ne décrit aucun événement réel.\n\n## Points clés\n\n- Premier point de démonstration sur le thème ${topic}.\n- Second point, à remplacer par le texte validé.\n\nLe texte définitif sera saisi dans le back-office.`,
        en: `This demo content does not describe any real event.\n\n## Key points\n\n- A first demo point about ${topic}.\n- A second point, to be replaced with approved text.\n\nThe final text will be entered in the back office.`,
      },
      date: `2025-${month}-${String(1 + Math.floor(random() * 27)).padStart(2, "0")}`,
      tags: [topic],
      kind,
      sourceUrl: kind === "watch" ? "https://example.org/" : undefined,
      imageUrl: i % 4 === 0 ? `/api/v1/news/${kind}-${i + 1}/image.svg` : undefined,
    };
  });
}

/** CMS pages (brief §5.9) with one example of each block type somewhere. */
function buildPages(shortName: string): Fixtures["pages"] {
  const demo = {
    fr: `${shortName} : contenu de démonstration, à remplacer par le texte validé.`,
    en: `${shortName}: demo content, to be replaced with approved text.`,
  };
  const text = (fr: string, en: string): CmsBlock => ({
    type: "richText",
    body: { fr, en } as never,
  });
  const page = (slug: string, fr: string, en: string, blocks: CmsBlock[]) => ({
    slug,
    title: { fr, en },
    blocks: [{ type: "richText", body: demo as never }, ...blocks],
  });
  return [
    page("about", "À propos", "About", [
      text(
        "## Notre mission\n\nL'observatoire mesure la transformation numérique du pays avec des données ouvertes, comparables et documentées.",
        "## Our mission\n\nThe observatory measures the country's digital transformation with open, comparable and documented data.",
      ),
      {
        type: "callout",
        body: {
          fr: "Les chiffres affichés sur ce site sont des données de démonstration.",
          en: "The figures on this site are demo data.",
        } as never,
      },
      {
        type: "image",
        src: "/api/v1/pages/about/image.svg",
        alt: { fr: "Illustration de démonstration", en: "Demo illustration" } as never,
      },
    ]),
    page("methodology", "Méthodologie", "Methodology", [
      text(
        "## Production des indicateurs\n\nChaque indicateur suit les définitions de l'UIT lorsqu'elles existent.",
        "## How indicators are produced\n\nEach indicator follows the ITU definition where one exists.",
      ),
      {
        type: "table",
        rows: [
          [
            { fr: "Étape", en: "Step" },
            { fr: "Description", en: "Description" },
          ],
          [
            { fr: "Collecte", en: "Collection" },
            {
              fr: "Questionnaires et données administratives",
              en: "Questionnaires and administrative data",
            },
          ],
          [
            { fr: "Validation", en: "Validation" },
            { fr: "Contrôles de cohérence et revue", en: "Consistency checks and review" },
          ],
          [
            { fr: "Publication", en: "Publication" },
            { fr: "Mise en ligne avec les métadonnées", en: "Release with metadata" },
          ],
        ] as never,
      },
    ]),
    page("partners", "Partenaires", "Partners", [
      {
        type: "partners",
        partners: [
          {
            name: {
              fr: "Ministère chargé du numérique",
              en: "Ministry in charge of digital affairs",
            },
          },
          { name: { fr: "Autorité de régulation", en: "Regulatory authority" } },
          { name: { fr: "Institut national de la statistique", en: "National statistics office" } },
          {
            name: {
              fr: "Union internationale des télécommunications",
              en: "International Telecommunication Union",
            },
            url: "https://www.itu.int/",
          },
        ] as never,
      },
    ]),
    page("privacy", "Confidentialité", "Privacy", [
      text(
        "## Données collectées\n\nLe site ne dépose pas de cookie de mesure d'audience. Les formulaires ne conservent que les informations que vous saisissez.",
        "## Data we collect\n\nThe site sets no analytics cookies. Forms keep only the information you enter.",
      ),
    ]),
    page("terms", "Conditions d'utilisation", "Terms of use", [
      text(
        "## Réutilisation des données\n\nLes données sont publiées sous licence CC BY 4.0 : citez la source lorsque vous les réutilisez.",
        "## Reusing the data\n\nThe data is published under CC BY 4.0: cite the source when you reuse it.",
      ),
    ]),
    page("accessibility", "Accessibilité", "Accessibility", [
      text(
        "## Conformité\n\nCe site vise le niveau AA des WCAG 2.2. Signalez tout obstacle via le formulaire d'avis.",
        "## Compliance\n\nThis site aims for WCAG 2.2 level AA. Report any barrier through the feedback form.",
      ),
    ]),
  ] as Fixtures["pages"];
}

function buildIndex(random: () => number): Fixtures["index"] {
  return YEARS.map((year, i) => {
    const t = i / (YEARS.length - 1);
    const pillars = PILLARS.map((pillar) => ({
      code: pillar.code,
      name: pillar.name,
      score: Math.round((25 + 40 * t + random() * 10) * 10) / 10,
    }));
    const score = pillars.reduce((sum, p) => sum + p.score, 0) / pillars.length;
    return { year: String(year), score: Math.round(score * 10) / 10, pillars };
  });
}

/** Boundary files from boundaries/{ISO3}: one "areas" object, geometries carrying `name` (and `parent` at adm2). */
export type Boundaries = Partial<
  Record<
    "adm1" | "adm2",
    { objects: { areas: { geometries: { properties?: Record<string, unknown> }[] } } }
  >
>;

/** Sets each shape's code from the area with the same name (and parent); every area needs one shape. */
function withCodes(
  config: CountryConfig,
  areas: Fixtures["areas"],
  level: "adm1" | "adm2",
  source: NonNullable<Boundaries["adm1"]>,
) {
  const label = (name: string | L) => (typeof name === "string" ? name : name.fr);
  const nameOf = new Map(areas.map((area) => [area.code, label(area.name)]));
  const key = (name: unknown, parent: unknown) => `${String(parent ?? "")}/${String(name)}`;
  const codes = new Map(
    areas
      .filter((area) => area.level === level)
      .map((area) => [
        key(label(area.name), level === "adm2" ? nameOf.get(area.parent as string) : undefined),
        area,
      ]),
  );
  const topology = structuredClone(source);
  for (const geometry of topology.objects.areas.geometries) {
    const id = key(geometry.properties?.name, geometry.properties?.parent);
    const area = codes.get(id);
    if (!area) throw new Error(`${level}: no area for shape ${id}`);
    geometry.properties = { [config.geography.codeProperty]: area.code, name: area.name };
    codes.delete(id);
  }
  if (codes.size) throw new Error(`${level}: no shape for ${[...codes.keys()].join(", ")}`);
  return topology;
}

/**
 * Boundary files when the country has them (geoBoundaries stand-ins until official files arrive),
 * otherwise rectangles inside the bbox.
 */
function buildGeometry(config: CountryConfig, areas: Fixtures["areas"], boundaries: Boundaries) {
  if (boundaries.adm1 && boundaries.adm2) {
    return {
      adm1: withCodes(config, areas, "adm1", boundaries.adm1),
      adm2: withCodes(config, areas, "adm2", boundaries.adm2),
    };
  }
  const [west, south, east, north] = config.geography.bbox;
  const regions = areas.filter((area) => area.level === "adm1");
  const columns = Math.ceil(Math.sqrt(regions.length));
  const rows = Math.ceil(regions.length / columns);
  const width = (east - west) / columns;
  const height = (north - south) / rows;
  const box = (x: number, y: number, w: number, h: number) => [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y],
  ];
  const topology = (cells: { area: Fixtures["areas"][number]; ring: number[][] }[]) => ({
    type: "Topology",
    bbox: config.geography.bbox,
    objects: {
      areas: {
        type: "GeometryCollection",
        geometries: cells.map(({ area }, i) => ({
          type: "Polygon",
          arcs: [[i]],
          properties: { [config.geography.codeProperty]: area.code, name: area.name },
        })),
      },
    },
    arcs: cells.map(({ ring }) => ring),
  });

  const adm1Cells = regions.map((area, i) => ({
    area,
    ring: box(
      west + (i % columns) * width,
      north - (Math.floor(i / columns) + 1) * height,
      width,
      height,
    ),
  }));
  const adm2Cells = regions.flatMap((region, i) => {
    const children = areas.filter((area) => area.parent === region.code);
    const x = west + (i % columns) * width;
    const y = north - (Math.floor(i / columns) + 1) * height;
    const step = width / children.length;
    return children.map((area, j) => ({ area, ring: box(x + j * step, y, step, height) }));
  });
  return { adm1: topology(adm1Cells), adm2: topology(adm2Cells) };
}

export function generateFixtures(
  config: CountryConfig,
  seed: number,
  boundaries: Boundaries = {},
): Fixtures {
  const random = createRandom(seed);
  const countryName = config.name;
  const shortName = config.observatory.shortName;
  const areas = buildAreas(config);
  const dashboards = buildDashboards(config);
  const firstRegion = areas.find((area) => area.level === "adm1")?.code as string;
  const pct = (fr: string, en: string): L => ({ fr, en });

  return {
    meta: {
      iso3: config.iso3,
      locales: config.locales.enabled,
      defaultLocale: config.locales.default,
      defaultPeerGroup: config.peers.default,
    },
    pillars: PILLARS.map((pillar, i) => ({ ...pillar, order: i + 1 })),
    indicators: buildIndicators(areas.length, dashboards) as Fixtures["indicators"],
    unitFactors: Object.fromEntries(
      INDICATORS.filter((item) => item.countVariant).map((item) => [
        item.code,
        { people: 170_000 },
      ]),
    ),
    areas,
    observations: buildObservations(config, areas, random),
    peers: buildPeers(config, random),
    dashboards,
    publications: buildPublications(random),
    news: buildNews(random),
    home: {
      mission: {
        fr: `Les données de référence sur le numérique : ${countryName.fr ?? ""}.`,
        en: `Reference data on digital development: ${countryName.en ?? ""}.`,
      },
      lastUpdated: GENERATED_ON,
      exampleChips: [
        {
          label: pct("Utilisateurs d'Internet", "Internet users"),
          href: "/data/ACCESS.INTERNET_USERS",
        },
        {
          label: pct("Couverture 4G par région", "4G coverage by region"),
          href: "/map?i=CONN.4G_POP",
        },
        {
          label: pct("Écart entre femmes et hommes", "Gender gap"),
          href: "/data/ACCESS.INTERNET_USERS?d=sex:*",
        },
        {
          label: pct("Coût de 2 Go", "Cost of 2 GB"),
          href: `/data/AFFORD.DATA_2GB?c=peer:${config.peers.default}`,
        },
        { label: pct("Région à la loupe", "A region up close"), href: `/data?a=${firstRegion}` },
      ],
      featuredIndicators: INDICATORS.filter((item) => item.isHeadline)
        .slice(0, 8)
        .map((item) => item.code),
      mapTeaserIndicator: "CONN.4G_POP",
      benchmarkIndicator: "ACCESS.INTERNET_USERS",
      partners: ["Partenaire A", "Partenaire B", "Partenaire C", "Partenaire D"].map((name, i) => ({
        name,
        logo: `/brand/logo.svg`,
        lastSubmission: `2026-0${i + 6}-15`,
      })),
    },
    targets: {
      name: { fr: "Stratégie numérique nationale 2030", en: "National Digital Strategy 2030" },
      targets: [
        ["CONN.4G_POP", 98],
        ["ACCESS.INTERNET_USERS", 85],
        ["SKILLS.BASIC", 60],
        ["GOV.ESERVICES", 90],
      ].map(([code, target]) => {
        const seedRow = INDICATORS.find((item) => item.code === code) as IndicatorSeed;
        return {
          indicator: seedRow.code,
          name: seedRow.name,
          unit: UNITS[seedRow.unit] as L,
          target: target as number,
          targetYear: "2030",
        };
      }),
    },
    index: buildIndex(random),
    pages: buildPages(shortName),
    datasets: [
      ...PILLARS.map((pillar) => ({
        code: pillar.code,
        title: pillar.name,
        description: pillar.description,
        pillar: pillar.code,
        formats: ["CSV", "JSON"],
        licence: "CC BY 4.0",
        updateFrequency: { fr: "Trimestrielle", en: "Quarterly" },
        lastUpdated: GENERATED_ON,
        url: `/api/v1/datasets/${pillar.code}/file`,
      })),
      {
        code: "ALL",
        title: { fr: "Toutes les données", en: "All data" },
        description: {
          fr: "Toutes les observations publiées, tous indicateurs et territoires confondus.",
          en: "Every published observation, for all indicators and areas.",
        },
        formats: ["CSV", "JSON"],
        licence: "CC BY 4.0",
        updateFrequency: { fr: "Trimestrielle", en: "Quarterly" },
        lastUpdated: GENERATED_ON,
        url: "/api/v1/datasets/ALL/file",
      },
    ],
    geo: buildGeometry(config, areas, boundaries),
  };
}
