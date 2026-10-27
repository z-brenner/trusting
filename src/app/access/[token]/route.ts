import { NextRequest, NextResponse } from "next/server";
import { getActiveGrant } from "@/lib/documents/access";
import { env, isProduction } from "@/lib/env";

const GRANT_COOKIE = "tc_grant";

/**
 * Entry point of an approval email: /access/<token>.
 * Validates the grant, stores the raw token in an httpOnly cookie (the download
 * route checks it on every file request) and redirects to /access, which lists
 * the documents. Cookies can only be set from a Route Handler or Server Action.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const base = env().APP_URL;
  const grant = await getActiveGrant(token);

  if (!grant || !grant.grantExpiresAt) {
    return NextResponse.redirect(new URL("/access?status=invalid", base), { status: 303 });
  }

  const res = NextResponse.redirect(new URL("/access", base), { status: 303 });
  res.cookies.set(GRANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    expires: grant.grantExpiresAt,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
