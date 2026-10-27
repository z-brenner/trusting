import { headers } from "next/headers";
import { env } from "./env";

/** Best-effort client IP. Only trusts X-Forwarded-For when TRUST_PROXY=true. */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  if (env().TRUST_PROXY) {
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = h.get("x-real-ip");
    if (real) return real.trim();
  }
  return h.get("x-client-ip") ?? null;
}

export function clientIpFromRequest(req: Request): string | null {
  if (env().TRUST_PROXY) {
    const xff = req.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
    const real = req.headers.get("x-real-ip");
    if (real) return real.trim();
  }
  return null;
}

/**
 * CSRF protection for route handlers that mutate state.
 * Server Actions already enforce an Origin check; route handlers need this.
 * Rejects cross-site requests by checking Sec-Fetch-Site / Origin against APP_URL.
 */
export function assertSameOrigin(req: Request): void {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new CsrfError();
  }
  const origin = req.headers.get("origin");
  if (origin) {
    const allowed = new URL(env().APP_URL).origin;
    const requestOrigin = new URL(req.url).origin;
    if (origin !== allowed && origin !== requestOrigin) throw new CsrfError();
  }
}

export class CsrfError extends Error {
  constructor() {
    super("Cross-site request rejected");
  }
}

export function userAgentFromRequest(req: Request): string | null {
  return req.headers.get("user-agent")?.slice(0, 255) ?? null;
}
