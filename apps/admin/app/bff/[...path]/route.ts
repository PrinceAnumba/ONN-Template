import { apiUrl } from "@onn/api-client";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Same-origin proxy for client islands that call the admin API: file uploads with progress, the
 * entry grid's autosave and template downloads. The session token is an httpOnly cookie, so the
 * browser can't send the bearer header itself; this adds it. Only `/admin/*` is reachable, and
 * writes must come from this origin (the cookie would otherwise allow cross-site requests).
 * Responses are never cached (brief §8).
 */
async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return problem(401, "Sign in again");
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!origin || new URL(origin).host !== host) return problem(403, "Cross-site request");
  }
  const { path } = await params;
  const target = `${apiUrl(`/admin/${path.map(encodeURIComponent).join("/")}`)}${request.nextUrl.search}`;
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    "Accept-Language": await getLocale(),
  });
  const type = request.headers.get("content-type");
  if (type) headers.set("Content-Type", type);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(target, {
    method: request.method,
    headers,
    cache: "no-store",
    ...(hasBody ? { body: request.body, duplex: "half" } : {}),
  } as RequestInit).catch(() => null);
  if (!response) return problem(502, "The API can't be reached");
  const out = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["content-type", "content-disposition"]) {
    const value = response.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers: out });
}

function problem(status: number, title: string) {
  return Response.json(
    { type: "about:blank", title, status },
    {
      status,
      headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store" },
    },
  );
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH };
