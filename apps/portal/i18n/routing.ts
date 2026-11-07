import { country } from "@onn/config";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: country.locales.enabled,
  defaultLocale: country.locales.default,
  localePrefix: "always",
});
