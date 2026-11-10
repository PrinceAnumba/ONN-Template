import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { HomeEditor } from "@/components/pages/home-editor";
import { pickerData } from "@/lib/picker-data";
import { requireSession } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.pages"))("home.title") };
}

/** Home page modules: example chips, featured indicators, map and benchmark picks (brief §7). */
export default async function HomeModulesPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.pages");
  const [home, picker] = await Promise.all([
    adminApi.homeModules({ locale, token: session.token }),
    pickerData(locale),
  ]);
  return (
    <>
      <Link href="/pages" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <HomeEditor
        initial={home}
        indicators={picker.indicators}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
