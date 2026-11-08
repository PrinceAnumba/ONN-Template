import { country } from "@onn/config";
import { getTranslations } from "next-intl/server";

/** Credit for the boundary files (config `geography.boundaries`), shown under every map. */
export async function boundaryCredit() {
  const t = await getTranslations("Map");
  const { attribution, official } = country.geography.boundaries;
  return t("boundaries", { attribution, official: String(official) });
}
