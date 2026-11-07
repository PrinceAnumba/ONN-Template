import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "expected a #RRGGBB colour");
const iso3 = z.string().regex(/^[A-Z]{3}$/, "expected an ISO3 code");
const localised = z.record(z.string(), z.string().min(1));
const assetPath = z.string().startsWith("/");

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const geographyLevel = z.strictObject({
  key: z.enum(["adm1", "adm2", "adm3"]),
  label: localised,
  topojson: assetPath,
  lazy: z.boolean(),
});

const peerGroup = z.strictObject({
  name: localised,
  members: z.array(iso3).min(1),
});

export const countrySchema = z
  .strictObject({
    iso3,
    name: localised,
    observatory: z.strictObject({
      shortName: z.string().min(1),
      longName: localised,
      supportEmail: z.email(),
    }),
    owner: z.strictObject({
      ministry: localised,
      unit: localised,
      funders: z.array(z.strictObject({ name: z.string().min(1), logo: assetPath })),
    }),
    locales: z.strictObject({
      default: z.string().min(2),
      enabled: z.array(z.string().min(2)).min(1),
      rtl: z.array(z.string().min(2)),
    }),
    currency: z.string().regex(/^[A-Z]{3}$/, "expected an ISO 4217 code"),
    // Maps each enabled locale to the BCP 47 tag used for Intl formatters, so a locale with
    // thin Intl data (e.g. wo) can format through a tested fallback.
    numberFormat: z.record(z.string(), z.string().min(2)),
    timezone: z.string().refine(isValidTimezone, "expected an IANA timezone"),
    geography: z.strictObject({
      levels: z.array(geographyLevel).min(1),
      codeProperty: z.string().min(1),
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    }),
    peers: z.strictObject({
      default: z.string().min(1),
      groups: z.record(z.string(), peerGroup),
    }),
    brand: z.strictObject({
      primary: hex,
      secondary: hex,
      accent: hex,
      neutralDark: hex,
      logo: assetPath,
      favicon: assetPath,
    }),
    features: z.strictObject({
      newsWatch: z.boolean(),
      smsSignup: z.boolean(),
      chatbot: z.boolean(),
      basemap: z.boolean(),
    }),
    // Keys below are not in brief §2 but are needed by §5.9, §4.3 and §7.
    legal: z.strictObject({
      dataProtectionLaw: localised,
      dataProtectionAuthority: localised,
    }),
    social: z.array(z.strictObject({ label: z.string().min(1), url: z.url() })),
    auth: z.strictObject({ ssoName: z.string().min(1) }),
  })
  .superRefine((config, ctx) => {
    const { enabled, rtl, default: defaultLocale } = config.locales;
    const issue = (path: PropertyKey[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (!enabled.includes(defaultLocale)) {
      issue(["locales", "default"], `"${defaultLocale}" is not in locales.enabled`);
    }
    for (const locale of rtl) {
      if (!enabled.includes(locale)) issue(["locales", "rtl"], `"${locale}" is not enabled`);
    }
    if (!(config.peers.default in config.peers.groups)) {
      issue(["peers", "default"], `"${config.peers.default}" is not in peers.groups`);
    }

    const requireLocales = (record: Record<string, string>, path: PropertyKey[]) => {
      for (const locale of enabled) {
        if (!record[locale]) issue([...path, locale], `missing text for locale "${locale}"`);
      }
    };
    requireLocales(config.name, ["name"]);
    requireLocales(config.observatory.longName, ["observatory", "longName"]);
    requireLocales(config.owner.ministry, ["owner", "ministry"]);
    requireLocales(config.owner.unit, ["owner", "unit"]);
    requireLocales(config.numberFormat, ["numberFormat"]);
    requireLocales(config.legal.dataProtectionLaw, ["legal", "dataProtectionLaw"]);
    requireLocales(config.legal.dataProtectionAuthority, ["legal", "dataProtectionAuthority"]);
    config.geography.levels.forEach((level, i) =>
      requireLocales(level.label, ["geography", "levels", i, "label"]),
    );
    for (const [code, group] of Object.entries(config.peers.groups)) {
      requireLocales(group.name, ["peers", "groups", code, "name"]);
    }
  });

export type CountryConfig = z.infer<typeof countrySchema>;
