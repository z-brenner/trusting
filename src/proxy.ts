import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "tc_session";

/**
 * Lightweight routing guard. Real authorization happens server-side in
 * requireAdmin(); this only avoids rendering admin pages for anonymous visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (pathname.startsWith("/admin") && !hasCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
