import { NextResponse, type NextRequest } from "next/server";

/** Passes the path to server layouts, which can't read it, so the shell can refuse a section the
 * role can't reach with a real 404 before the page starts streaming. */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-onn-path", request.nextUrl.pathname.replace(/^\/admin(?=\/|$)/, "") || "/");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next|api|geo|vendor|brand|.*\\.(?:ico|png|svg|js|css|map|woff2|txt|json)$).*)"],
};
