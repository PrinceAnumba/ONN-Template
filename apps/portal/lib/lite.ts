import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { LITE_COOKIE } from "./lite-cookie";

/**
 * Lite mode (brief §9): the cookie wins, so a viewer who turned it off stays off; without one,
 * the browser's `Save-Data: on` header turns it on for the first visit (spec decision). The
 * client toggle also turns it on from `navigator.connection` where browsers expose it.
 */
export const isLite = cache(async () => {
  const value = (await cookies()).get(LITE_COOKIE)?.value;
  if (value === "1") return true;
  if (value === "0") return false;
  return (await headers()).get("save-data")?.toLowerCase() === "on";
});
