import { NextResponse, type NextRequest } from "next/server";
import { liteCookie } from "@/lib/lite-cookie";

/**
 * No-JavaScript path for the footer Lite toggle: the form posts `lite=1|0` here, and we set the
 * cookie and go back to the page it came from (same origin only).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const form = await request.formData();
  const on = form.get("lite") === "1";
  let back = new URL(`/${locale}`, request.url);
  const referer = request.headers.get("referer");
  if (referer) {
    const url = new URL(referer);
    if (url.origin === back.origin) back = url;
  }
  const response = NextResponse.redirect(back, 303);
  response.headers.append("set-cookie", liteCookie(on));
  return response;
}
