import { country } from "@onn/config";
import { loadMessages } from "@onn/i18n";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// The admin has no locale in its paths; the profile menu stores the choice in a cookie.
export default getRequestConfig(async () => {
  const stored = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale =
    stored && country.locales.enabled.includes(stored) ? stored : country.locales.default;
  return { locale, messages: await loadMessages(locale), timeZone: country.timezone };
});
