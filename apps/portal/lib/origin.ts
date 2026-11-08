import { headers } from "next/headers";

/** Absolute site origin: `NEXT_PUBLIC_SITE_URL`, else the request's own host, so links stay pasteable. */
export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const head = await headers();
  const host = head.get("x-forwarded-host") ?? head.get("host");
  return host ? `${head.get("x-forwarded-proto") ?? "http"}://${host}` : "";
}
