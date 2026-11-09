import type { ChartFrameLabels } from "@onn/charts/chart-frame";
import type { LineSpec } from "@onn/charts/spec";
import { getTranslations } from "next-intl/server";

/** Translated labels for ChartFrame, which stays free of next-intl (same as the portal's). */
export async function chartFrameLabels(): Promise<ChartFrameLabels> {
  const t = await getTranslations("Chart");
  return {
    download: t("download"),
    png: t("png"),
    svg: t("svg"),
    csv: t("csv"),
    share: t("share"),
    embed: t("embed"),
    viewTable: t("viewTable"),
    hideTable: t("hideTable"),
    copied: t("copied"),
    error: t("error"),
    retry: t("retry"),
    empty: t("empty"),
  };
}

export async function lineLabels(): Promise<LineSpec["labels"]> {
  const t = await getTranslations("Chart");
  return {
    period: t("period"),
    breakInSeries: t("breakInSeries"),
    range: t("range"),
    status: {
      E: t("status.E"),
      P: t("status.P"),
      B: t("status.B"),
      F: t("status.F"),
      M: t("status.M"),
    },
  };
}
