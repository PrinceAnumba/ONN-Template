import type { CountryConfig } from "../schema";

// PLACEHOLDER: brand colours, logos, institutions, legal text and contacts are unverified, and the
// Wolof values that repeat the French text await review. Replace with supplied values.
const config: CountryConfig = {
  iso3: "SEN",
  name: { fr: "Sénégal", en: "Senegal", wo: "Senegaal" },
  observatory: {
    shortName: "ONN",
    longName: {
      fr: "Observatoire national du numérique",
      en: "National Digital Observatory",
      wo: "Observatoire national du numérique",
    },
    supportEmail: "contact@example.org",
  },
  owner: {
    ministry: {
      fr: "Ministère en charge du numérique",
      en: "Ministry in charge of digital affairs",
      wo: "Ministère en charge du numérique",
    },
    unit: {
      fr: "Unité de gestion de l'observatoire",
      en: "Observatory management unit",
      wo: "Unité de gestion de l'observatoire",
    },
    funders: [],
  },
  locales: { default: "fr", enabled: ["fr", "en", "wo"], rtl: [] },
  currency: "XOF",
  numberFormat: { fr: "fr-SN", en: "en-SN", wo: "fr-SN" },
  timezone: "Africa/Dakar",
  geography: {
    levels: [
      {
        key: "adm1",
        label: { fr: "Régions", en: "Regions", wo: "Régions" },
        topojson: "/geo/SEN/adm1.topo.json",
        lazy: false,
      },
      {
        key: "adm2",
        label: { fr: "Départements", en: "Departments", wo: "Départements" },
        topojson: "/geo/SEN/adm2.topo.json",
        lazy: false,
      },
      {
        key: "adm3",
        label: { fr: "Communes", en: "Municipalities", wo: "Communes" },
        topojson: "/geo/SEN/adm3.topo.json",
        lazy: true,
      },
    ],
    codeProperty: "code",
    bbox: [-17.6, 12.3, -11.3, 16.7],
  },
  peers: {
    default: "ECOWAS",
    groups: {
      ECOWAS: {
        name: { fr: "CEDEAO", en: "ECOWAS", wo: "CEDEAO" },
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
      WAEMU: {
        name: { fr: "UEMOA", en: "WAEMU", wo: "UEMOA" },
        members: ["BEN", "BFA", "CIV", "GNB", "MLI", "NER", "SEN", "TGO"],
      },
    },
  },
  brand: {
    primary: "#00853F",
    secondary: "#FDEF42",
    accent: "#E31B23",
    neutralDark: "#0F1C2E",
    logo: "/brand/logo.svg",
    favicon: "/brand/favicon.svg",
  },
  features: { newsWatch: true, smsSignup: false, chatbot: false, basemap: false },
  legal: {
    dataProtectionLaw: {
      fr: "Loi nationale sur la protection des données personnelles",
      en: "National personal data protection law",
      wo: "Loi nationale sur la protection des données personnelles",
    },
    dataProtectionAuthority: {
      fr: "Autorité nationale de protection des données",
      en: "National data protection authority",
      wo: "Autorité nationale de protection des données",
    },
  },
  social: [],
  auth: { ssoName: "SSO" },
};

export default config;
