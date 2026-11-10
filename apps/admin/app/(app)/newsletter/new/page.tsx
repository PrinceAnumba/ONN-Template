import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CampaignComposer } from "@/components/newsletter/campaign-composer";
import { requireSession } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getTranslations("Admin.newsletter"))("newTitle") };
}

/** New newsletter: composed and saved as a draft, then sent from its page (brief §7). */
export default async function NewCampaignPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.newsletter");
  const options = await adminApi.campaignOptions({ locale, token: session.token });
  return (
    <>
      <Link href="/newsletter" className="inline-flex min-h-11 items-center underline">
        {t("back")}
      </Link>
      <CampaignComposer
        options={options}
        locales={country.locales.enabled}
        defaultLocale={country.locales.default}
      />
    </>
  );
}
