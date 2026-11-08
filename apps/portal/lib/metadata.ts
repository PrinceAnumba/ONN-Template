import type { Indicator } from "@onn/api-client/types";
import type { MetadataDrawerProps } from "@onn/ui/components/metadata-drawer";
import { getTranslations } from "next-intl/server";

const SEPARATOR = " · ";

/** Labels and display strings for `MetadataDrawer`, shared by the indicator page and the catalogue. */
export async function metadataProps(): Promise<{
  labels: MetadataDrawerProps["labels"];
  display: (indicator: Indicator) => MetadataDrawerProps["display"];
}> {
  const [t, common] = await Promise.all([getTranslations("Indicator"), getTranslations("Common")]);
  return {
    labels: {
      title: t("metadata.title"),
      close: common("close"),
      code: t("metadata.code"),
      definition: t("metadata.definition"),
      computation: t("metadata.computation"),
      unit: t("metadata.unit"),
      periodicity: t("metadata.periodicity"),
      source: t("metadata.source"),
      intlRefs: t("metadata.intlRefs"),
      disaggregations: t("metadata.disaggregations"),
      coverage: t("metadata.coverage"),
      quality: t("metadata.quality"),
      versions: t("metadata.versions"),
      licence: t("metadata.licence"),
      reportIssue: t("metadata.reportIssue"),
    },
    display: (indicator) => ({
      periodicity: t(`periodicity.${indicator.periodicity}`),
      method: t(`method.${indicator.source.method}`),
      coverage: t("coverageValue", { ...indicator.coverage }),
      disaggregations: indicator.disaggregations
        .map((key) => (t.has(`dims.${key}`) ? t(`dims.${key}` as "dims.sex") : key))
        .join(SEPARATOR),
    }),
  };
}
