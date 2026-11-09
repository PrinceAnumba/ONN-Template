import { country } from "@onn/config";
import { getLocale, getTranslations } from "next-intl/server";
import { CmsPageView, cmsMetadata } from "@/components/cms/cms-page";
import { pick } from "@/lib/localised";

export const generateMetadata = () => cmsMetadata("privacy");

/** Privacy (brief §5.9): CMS text, plus the data protection law and authority from config. */
export default async function PrivacyPage() {
  const [t, locale] = await Promise.all([getTranslations("About"), getLocale()]);
  return (
    <CmsPageView
      slug="privacy"
      before={
        <dl className="bg-surface-2 grid max-w-prose gap-3 rounded-lg p-5">
          <div>
            <dt className="text-sm font-semibold">{t("law")}</dt>
            <dd>{pick(country.legal.dataProtectionLaw, locale)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">{t("authority")}</dt>
            <dd>{pick(country.legal.dataProtectionAuthority, locale)}</dd>
          </div>
        </dl>
      }
    />
  );
}
