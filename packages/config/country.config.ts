// Written by generate.ts for NEXT_PUBLIC_COUNTRY after Zod validation, so client bundles carry
// only the active country and no Zod.
import generated from "./generated/country.json";
import type { CountryConfig } from "./schema";

export const country = generated as unknown as CountryConfig;

export type { CountryConfig };
