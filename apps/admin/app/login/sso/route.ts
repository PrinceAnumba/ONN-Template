import { isMockMode } from "@onn/api-client";
import { adminApi } from "@onn/api-client/admin";
import { country } from "@onn/config";
import { NextResponse, type NextRequest } from "next/server";
import { MFA_COOKIE } from "@/lib/session";

const MFA_SECONDS = 5 * 60;

/**
 * SSO step of sign-in (brief §7), a plain form POST answered with a full redirect, as an identity
 * provider's would be. Against the mock it signs in as the chosen demo user; with a real API it
 * will hand over to Auth.js (OIDC), which isn't configured yet, so it shows the SSO error.
 */
export async function POST(request: NextRequest) {
  const back = (query: string) =>
    NextResponse.redirect(new URL(`/admin/login?${query}`, request.url), 303);
  if (!isMockMode) return back("error=sso");
  const userId = String((await request.formData()).get("user") ?? "");
  const locale = request.cookies.get("NEXT_LOCALE")?.value ?? country.locales.default;
  const users = await adminApi.demoUsers(locale).catch(() => []);
  if (!users.some((user) => user.id === userId)) return back("error=sso");
  const response = back("step=mfa");
  response.cookies.set(MFA_COOKIE, userId, {
    path: "/admin",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MFA_SECONDS,
  });
  return response;
}
