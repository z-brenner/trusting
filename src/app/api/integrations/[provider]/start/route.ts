import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { env, isProduction } from "@/lib/env";
import { getProvider } from "@/lib/integrations";
import { createOAuthCookie, generatePkce, generateState, OAUTH_COOKIE, OAUTH_COOKIE_TTL_SECONDS } from "@/lib/integrations/oauth";

export const dynamic = "force-dynamic";

/**
 * Begins the server-side authorization-code flow (with PKCE) for a provider.
 * The state and PKCE verifier are kept in a short-lived signed, httpOnly cookie that is
 * also bound to the administrator who started the flow.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: key } = await ctx.params;
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/admin/integrations")}`, env().APP_URL), 302);
  }
  const provider = getProvider(key);
  if (!provider || !provider.configured()) return new Response("Not found", { status: 404 });

  const state = generateState();
  const { verifier, challenge } = generatePkce();
  const res = NextResponse.redirect(provider.authUrl({ state, codeChallenge: challenge }), 302);
  res.cookies.set(OAUTH_COOKIE, createOAuthCookie({ p: provider.key, s: state, v: verifier, u: session.userId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/api/integrations",
    maxAge: OAUTH_COOKIE_TTL_SECONDS,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
