import { country } from "@onn/config";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: country.locales.enabled,
  defaultLocale: country.locales.default,
  localePrefix: "always",
  // Brief §9: `/` redirects by cookie, then Accept-Language, then the default. The middleware
  // sets the cookie on every page load (so it works without JavaScript) and `Link` sets it on a
  // client-side switch. A year, not next-intl's session default, so the choice is remembered.
  localeCookie: { maxAge: 60 * 60 * 24 * 365 },
});
