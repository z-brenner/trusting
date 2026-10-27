import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { env, isProduction } from "@/lib/env";
import { getProvider, saveTokens } from "@/lib/integrations";
import { OAUTH_COOKIE, readOAuthCookie, verifyOAuthState } from "@/lib/integrations/oauth";
import { clientIpFromRequest } from "@/lib/request";

export const dynamic = "force-dynamic";

/** Error codes shown on /admin/integrations. Never carries provider messages or tokens. */
export type CallbackErrorCode = "state" | "denied" | "exchange" | "account" | "session" | "provider";

/**
 * Provider redirect target. Verifies the state against the signed cookie (constant time),
 * exchanges the code with the PKCE verifier, fetches the account identity and stores the
 * tokens encrypted. Always clears the OAuth cookie.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: key } = await ctx.params;
  const provider = getProvider(key);
  if (!provider || !provider.configured()) return new Response("Not found", { status: 404 });

  const appUrl = env().APP_URL;
  const finish = (query: string) => {
    const res = NextResponse.redirect(new URL(`/admin/integrations?${query}`, appUrl), 302);
    res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/api/integrations", maxAge: 0 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  };
  const fail = (code: CallbackErrorCode) => finish(`error=${code}&provider=${provider.key}`);

  const session = await requireAdminApi();
  if (!session) {
    const res = NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(`/admin/integrations?error=session&provider=${provider.key}`)}`, appUrl),
      302,
    );
    res.cookies.set(OAUTH_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/api/integrations", maxAge: 0 });
    return res;
  }

  const params = req.nextUrl.searchParams;
  const payload = readOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value);
  const state = params.get("state") ?? "";

  // The provider reported an error (user cancelled, consent denied, ...).
  const providerError = params.get("error");
  if (providerError) {
    console.warn(`[integrations] ${provider.label}: authorization returned error "${providerError.slice(0, 64)}"`);
    // Only trust the state-bound flow enough to classify the error.
    if (!verifyOAuthState(payload, { provider: provider.key, state, userId: session.userId })) return fail("state");
    return fail(providerError === "access_denied" || providerError === "consent_required" ? "denied" : "provider");
  }

  if (!verifyOAuthState(payload, { provider: provider.key, state, userId: session.userId })) return fail("state");
  const code = params.get("code");
  if (!code || !payload) return fail("state");

  let tokens;
  try {
    tokens = await provider.exchangeCode({ code, codeVerifier: payload.v });
  } catch (err) {
    console.error(`[integrations] ${provider.label}: code exchange failed`, err instanceof Error ? err.message : err);
    return fail("exchange");
  }

  let account;
  try {
    account = await provider.getAccount(tokens.accessToken);
  } catch (err) {
    console.error(`[integrations] ${provider.label}: fetching account identity failed`, err instanceof Error ? err.message : err);
    return fail("account");
  }

  const row = await saveTokens(provider.key, tokens, { account, connectedById: session.userId });
  await audit({
    action: "integration.connected",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "integration",
    targetId: row.id,
    metadata: { provider: provider.key, accountEmail: account.email, scopes: row.scopes, refreshToken: Boolean(tokens.refreshToken) },
    ipAddress: clientIpFromRequest(req),
  });
  if (!tokens.refreshToken) {
    console.warn(`[integrations] ${provider.label}: no refresh token was issued; the connection will expire with the access token.`);
  }
  return finish(`connected=${provider.key}`);
}
