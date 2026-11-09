import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

const MAX_TAGS = 100;

/**
 * Publish webhook (CLAUDE.md "Data fetching split"): the backend, or the mock server, posts the
 * cache tags of what it published, e.g. `{"tags": ["indicator:CONN.4G_POP", "home"]}`.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET ?? "dev-revalidate";
  if (request.headers.get("X-Revalidate-Secret") !== secret) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === "string").slice(0, MAX_TAGS)
    : [];
  for (const tag of tags) revalidateTag(tag);
  return NextResponse.json({ revalidated: tags });
}
