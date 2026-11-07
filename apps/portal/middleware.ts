import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

// Matches file extensions, not every dot: indicator codes such as CONN.4G_POP contain one.
export const config = {
  matcher: [
    "/((?!api|geo|admin|brand|_next|_vercel|.*\\.(?:ico|png|jpg|svg|webp|avif|txt|xml|json|webmanifest|woff2|js|css|map)$).*)",
  ],
};
