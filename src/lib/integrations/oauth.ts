import { createHash } from "node:crypto";
import { constantTimeEqual, randomToken, signPayload, verifyPayload } from "../crypto";
import type { TokenSet } from "./types";

// ---------- PKCE (RFC 7636, S256) ----------

/** Derives the S256 code challenge for a verifier: BASE64URL(SHA256(ASCII(verifier))). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** A fresh 64-character verifier (RFC 7636 allows 43–128 chars) and its challenge. */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomToken(48);
  return { verifier, challenge: pkceChallenge(verifier) };
}

export function generateState(): string {
  return randomToken(24);
}

// ---------- Signed OAuth cookie (state + verifier, bound to the admin session) ----------

export const OAUTH_COOKIE = "tc_oauth";
export const OAUTH_COOKIE_TTL_SECONDS = 10 * 60;

export type OAuthCookiePayload = {
  /** provider key */
  p: string;
  /** state */
  s: string;
  /** PKCE verifier */
  v: string;
  /** admin user id the flow was started by */
  u: string;
};

export function createOAuthCookie(payload: OAuthCookiePayload): string {
  return signPayload(payload, OAUTH_COOKIE_TTL_SECONDS);
}

export function readOAuthCookie(value: string | undefined | null): OAuthCookiePayload | null {
  if (!value) return null;
  const parsed = verifyPayload<OAuthCookiePayload>(value);
  if (!parsed) return null;
  if (
    typeof parsed.p !== "string" ||
    typeof parsed.s !== "string" ||
    typeof parsed.v !== "string" ||
    typeof parsed.u !== "string"
  ) {
    return null;
  }
  return { p: parsed.p, s: parsed.s, v: parsed.v, u: parsed.u };
}

/** Constant-time comparison of the returned state with the one stored in the cookie. */
export function verifyOAuthState(
  payload: OAuthCookiePayload | null,
  expected: { provider: string; state: string; userId: string },
): boolean {
  if (!payload) return false;
  if (!expected.state || payload.s.length === 0) return false;
  const stateOk = constantTimeEqual(payload.s, expected.state);
  const providerOk = constantTimeEqual(payload.p, expected.provider);
  const userOk = constantTimeEqual(payload.u, expected.userId);
  return stateOk && providerOk && userOk;
}

// ---------- Errors ----------

export type IntegrationErrorCode =
  | "not_configured"
  | "not_connected"
  | "reconnect"
  | "permission"
  | "not_found"
  | "rate_limited"
  | "provider"
  | "network"
  | "too_large"
  | "unsupported"
  | "already_imported";

/**
 * Error surfaced to administrators. `message` is always safe to show in the UI;
 * raw provider responses are logged (status only) and never forwarded.
 */
export class IntegrationError extends Error {
  constructor(
    public code: IntegrationErrorCode,
    message: string,
    public status = 502,
    public fileName?: string,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

export function friendlyMessage(code: IntegrationErrorCode, providerLabel: string): string {
  switch (code) {
    case "not_configured":
      return `${providerLabel} is not configured on this server.`;
    case "not_connected":
      return `${providerLabel} is not connected. Connect it on the Integrations page first.`;
    case "reconnect":
      return `The connection to ${providerLabel} has expired or was revoked. Disconnect and connect it again.`;
    case "permission":
      return `${providerLabel} refused access to this item.`;
    case "not_found":
      return `This file could not be found in ${providerLabel}.`;
    case "rate_limited":
      return `${providerLabel} is limiting requests right now. Please try again in a minute.`;
    case "network":
      return `${providerLabel} could not be reached. Check the server's network connection.`;
    case "too_large":
      return "The file is larger than the upload limit.";
    case "unsupported":
      return "This item cannot be imported.";
    case "already_imported":
      return "This file has already been imported.";
    default:
      return `${providerLabel} returned an unexpected error. Please try again.`;
  }
}

export function errorFromStatus(status: number, providerLabel: string, fileName?: string): IntegrationError {
  let code: IntegrationErrorCode = "provider";
  if (status === 401) code = "reconnect";
  else if (status === 403) code = "permission";
  else if (status === 404) code = "not_found";
  else if (status === 429) code = "rate_limited";
  return new IntegrationError(code, friendlyMessage(code, providerLabel), status === 401 ? 401 : 502, fileName);
}

// ---------- HTTP helpers ----------

async function doFetch(url: string, init: RequestInit, providerLabel: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, redirect: init.redirect ?? "follow", signal: init.signal ?? AbortSignal.timeout(30_000) });
  } catch (err) {
    console.error(`[integrations] ${providerLabel}: network error calling ${safeUrl(url)}`, err instanceof Error ? err.message : err);
    throw new IntegrationError("network", friendlyMessage("network", providerLabel), 502);
  }
}

/** Strips query strings (which can carry tokens) before logging. */
function safeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "<url>";
  }
}

/** POST application/x-www-form-urlencoded (token endpoints). Never logs the body. */
export async function postForm(
  url: string,
  params: Record<string, string>,
  providerLabel: string,
): Promise<Record<string, unknown>> {
  const res = await doFetch(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(params).toString(),
    },
    providerLabel,
  );
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const code = typeof json.error === "string" ? json.error : "unknown";
    console.error(`[integrations] ${providerLabel}: token endpoint responded ${res.status} (${code})`);
    if (code === "invalid_grant") {
      throw new IntegrationError("reconnect", friendlyMessage("reconnect", providerLabel), 401);
    }
    throw new IntegrationError("provider", friendlyMessage("provider", providerLabel), 502);
  }
  return json;
}

/** GET JSON with a bearer token; maps HTTP errors to IntegrationError. */
export async function fetchJson<T>(url: string, accessToken: string, providerLabel: string): Promise<T> {
  const res = await doFetch(
    url,
    { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } },
    providerLabel,
  );
  if (!res.ok) {
    console.error(`[integrations] ${providerLabel}: ${safeUrl(url)} responded ${res.status}`);
    throw errorFromStatus(res.status, providerLabel);
  }
  return (await res.json()) as T;
}

/** GET raw bytes with a bearer token, refusing bodies above `maxBytes`. */
export async function fetchBytes(
  url: string,
  accessToken: string | null,
  maxBytes: number,
  providerLabel: string,
  fileName?: string,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const res = await doFetch(
    url,
    { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}, redirect: "follow" },
    providerLabel,
  );
  if (!res.ok) {
    console.error(`[integrations] ${providerLabel}: download ${safeUrl(url)} responded ${res.status}`);
    throw errorFromStatus(res.status, providerLabel, fileName);
  }
  const buffer = await readBodyWithLimit(res, maxBytes, fileName);
  return { buffer, contentType: res.headers.get("content-type") };
}

/** Reads a response body, aborting as soon as it exceeds the limit. */
export async function readBodyWithLimit(res: Response, maxBytes: number, fileName?: string): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new IntegrationError("too_large", tooLargeMessage(maxBytes), 413, fileName);
  }
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new IntegrationError("too_large", tooLargeMessage(maxBytes), 413, fileName);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export function tooLargeMessage(maxBytes: number): string {
  return `The file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`;
}

// ---------- Token responses ----------

/**
 * Normalises an OAuth 2.0 token response. When the provider omits a refresh token
 * (Google does on refresh), the previous one is kept.
 */
export function parseTokenResponse(
  json: Record<string, unknown>,
  previousRefreshToken: string | null,
  providerLabel: string,
): TokenSet {
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  if (!accessToken) {
    console.error(`[integrations] ${providerLabel}: token response had no access_token`);
    throw new IntegrationError("provider", friendlyMessage("provider", providerLabel), 502);
  }
  const expiresIn = Number(json.expires_in);
  const refreshToken = typeof json.refresh_token === "string" && json.refresh_token ? json.refresh_token : previousRefreshToken;
  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes: typeof json.scope === "string" ? json.scope : "",
  };
}

// ---------- File name helpers ----------

/** "SOC 2 Report.pdf" -> "SOC 2 Report". Leaves names without a short extension alone. */
export function titleFromFileName(name: string): string {
  const trimmed = name.trim();
  const match = /^(.*\S)\.([A-Za-z0-9]{1,5})$/.exec(trimmed);
  const title = match ? match[1] : trimmed;
  return (title || trimmed || "Untitled").slice(0, 200);
}

/** Builds a query string, omitting empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}
