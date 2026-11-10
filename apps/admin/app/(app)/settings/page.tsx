import { adminApi } from "@onn/api-client/admin";
import type { RuntimeSettingKey } from "@onn/api-client/types";
import { getLocale, getTranslations } from "next-intl/server";
import { ChannelTest } from "@/components/settings/channel-test";
import { SettingsForm } from "@/components/settings/settings-form";
import { formatDate, formatNumber } from "@/lib/format";
import { SETTING_KEYS } from "@/lib/governance";
import { requireSession } from "@/lib/session";

/** Settings (brief §7): runtime overrides, feature toggles, API quotas and gateway tests. */
export default async function SettingsPage() {
  const session = await requireSession();
  const locale = await getLocale();
  const t = await getTranslations("Admin.settings");
  const settings = await adminApi.settings({ locale, token: session.token });
  const defaultText = Object.fromEntries(
    SETTING_KEYS.map((key) => {
      const value = settings.defaults[key];
      return [key, /^\d+$/.test(value) ? formatNumber(Number(value), locale) : value];
    }),
  ) as Record<RuntimeSettingKey, string>;
  return (
    <>
      <h1 className="text-h1">{t("title")}</h1>
      <p className="text-muted-foreground mt-1 mb-8 max-w-2xl">
        {settings.updated && settings.updatedBy
          ? t("introUpdated", {
              date: formatDate(settings.updated, locale, "medium"),
              name: settings.updatedBy,
            })
          : t("intro")}
      </p>
      <SettingsForm key={settings.updated} initial={settings} defaultText={defaultText} />

      <section aria-labelledby="settings-tests" className="mt-12 max-w-3xl">
        <h2 id="settings-tests" className="text-h3">
          {t("tests")}
        </h2>
        <p className="text-muted-foreground mt-1 mb-4">{t("testsHelp")}</p>
        <div className="flex flex-col gap-4">
          <ChannelTest
            channel="smtp"
            facts={[
              { label: t("smtp.host"), value: settings.smtp.host },
              { label: t("smtp.from"), value: settings.smtp.from },
            ]}
            last={settings.smtp.lastTest}
          />
          <ChannelTest
            channel="sms"
            facts={[
              { label: t("sms.provider"), value: settings.sms.provider },
              { label: t("sms.sender"), value: settings.sms.sender },
            ]}
            last={settings.sms.lastTest}
          />
        </div>
      </section>
    </>
  );
}
