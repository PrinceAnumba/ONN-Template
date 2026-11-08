import type { CountryConfig } from "../schema";

// PLACEHOLDER: brand colours, logos, institutions, legal text and contacts are unverified.
// Replace with supplied values.
const config: CountryConfig = {
  iso3: "TGO",
  name: { fr: "Togo", en: "Togo" },
  observatory: {
    shortName: "ONN",
    longName: {
      fr: "Observatoire national du numérique",
      en: "National Digital Observatory",
    },
    supportEmail: "contact@example.org",
  },
  owner: {
    ministry: {
      fr: "Ministère en charge du numérique",
      en: "Ministry in charge of digital affairs",
    },
    unit: {
      fr: "Unité de gestion de l'observatoire",
      en: "Observatory management unit",
    },
    funders: [],
  },
  locales: { default: "fr", enabled: ["fr", "en"], rtl: [] },
  currency: "XOF",
  numberFormat: { fr: "fr-TG", en: "en-TG" },
  timezone: "Africa/Lome",
  geography: {
    levels: [
      {
        key: "adm1",
        label: { fr: "Régions", en: "Regions" },
        topojson: "/geo/TGO/adm1.topo.json",
        lazy: false,
      },
      {
        key: "adm2",
        label: { fr: "Préfectures", en: "Prefectures" },
        topojson: "/geo/TGO/adm2.topo.json",
        lazy: true,
      },
    ],
    codeProperty: "code",
    bbox: [-0.2, 6.0, 1.9, 11.2],
    // Stand-in until INSEED supplies official boundaries (packages/mocks/boundaries/import.ts).
    boundaries: {
      attribution:
        "geoBoundaries (© OpenStreetMap contributors, Wambacher, 2017), ODbL 1.0 / CC BY-SA 2.0",
      url: "https://www.geoboundaries.org",
      official: false,
    },
  },
  peers: {
    default: "WAEMU",
    groups: {
      WAEMU: {
        name: { fr: "UEMOA", en: "WAEMU" },
        members: ["BEN", "BFA", "CIV", "GNB", "MLI", "NER", "SEN", "TGO"],
      },
      ECOWAS: {
        name: { fr: "CEDEAO", en: "ECOWAS" },
        members: [
          "BEN",
          "CIV",
          "CPV",
          "GHA",
          "GIN",
          "GMB",
          "GNB",
          "LBR",
          "NER",
          "NGA",
          "SEN",
          "SLE",
          "TGO",
        ],
      },
    },
  },
  brand: {
    primary: "#006A4E",
    secondary: "#FFCE00",
    accent: "#D21034",
    neutralDark: "#0F1C2E",
    logo: "/brand/logo.svg",
    favicon: "/brand/favicon.svg",
  },
  features: { newsWatch: true, smsSignup: false, chatbot: false, basemap: false },
  legal: {
    dataProtectionLaw: {
      fr: "Loi nationale sur la protection des données personnelles",
      en: "National personal data protection law",
    },
    dataProtectionAuthority: {
      fr: "Autorité nationale de protection des données",
      en: "National data protection authority",
    },
  },
  social: [],
  auth: { ssoName: "SSO" },
};

export default config;
