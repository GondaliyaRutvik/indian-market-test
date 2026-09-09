import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Gate every page and API route behind the session cookie, except the login
 * screen and the cron endpoint (which carries its own CRON_SECRET).
 *
 * Signature verification itself lives in the route handlers — middleware runs on
 * the edge runtime where node:crypto is unavailable, so here we only check that
 * a cookie is present and let the handlers do the real check.
 */
const PUBLIC_PATHS = ["/login", "/api/login", "/api/cron"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // No password configured (typical for local development) — no gate at all,
  // otherwise the user is bounced to a login screen with nothing to type.
  if (!(process.env.APP_PASSWORD ?? "").trim()) {
    return NextResponse.next();
  }

  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasCookie) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // The web manifest and icons must stay publicly readable: a browser fetches
  // the manifest before any session exists, and gating it behind login makes the
  // app uninstallable as a PWA.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.png$|.*\\.svg$|.*\\.ico$).*)",
  ],
};
