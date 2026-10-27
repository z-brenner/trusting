import { describe, expect, it } from "vitest";
import {
  createOAuthCookie,
  errorFromStatus,
  generatePkce,
  generateState,
  parseTokenResponse,
  pkceChallenge,
  readOAuthCookie,
  titleFromFileName,
  verifyOAuthState,
} from "@/lib/integrations/oauth";
import {
  buildGoogleQuery,
  escapeDriveQueryValue,
  googleExportFileName,
  isGoogleNative,
  normalizeGoogleFile,
} from "@/lib/integrations/google";
import { escapeGraphSearchTerm, isSafeGraphNextLink, normalizeMicrosoftItem } from "@/lib/integrations/microsoft";

describe("PKCE", () => {
  it("derives the S256 challenge from RFC 7636 appendix B", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("generates a 64-char url-safe verifier with a matching challenge", () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(verifier).toHaveLength(64);
    expect(pkceChallenge(verifier)).toBe(challenge);
    expect(generatePkce().verifier).not.toBe(verifier);
  });
  it("state is unguessable and url safe", () => {
    const s = generateState();
    expect(s).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(generateState()).not.toBe(s);
  });
});

describe("OAuth state cookie", () => {
  const payload = { p: "google", s: generateState(), v: generatePkce().verifier, u: "user_1" };

  it("round-trips through the signed cookie", () => {
    const cookie = createOAuthCookie(payload);
    expect(readOAuthCookie(cookie)).toEqual(payload);
  });
  it("rejects tampered, malformed or missing cookies", () => {
    const cookie = createOAuthCookie(payload);
    expect(readOAuthCookie(cookie.slice(0, -1) + (cookie.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(readOAuthCookie("garbage")).toBeNull();
    expect(readOAuthCookie(undefined)).toBeNull();
    expect(readOAuthCookie("")).toBeNull();
  });
  it("verifies state, provider and user together", () => {
    const expected = { provider: "google", state: payload.s, userId: "user_1" };
    expect(verifyOAuthState(payload, expected)).toBe(true);
    expect(verifyOAuthState(payload, { ...expected, state: payload.s.slice(0, -1) + "x" })).toBe(false);
    expect(verifyOAuthState(payload, { ...expected, state: "" })).toBe(false);
    expect(verifyOAuthState(payload, { ...expected, provider: "microsoft" })).toBe(false);
    expect(verifyOAuthState(payload, { ...expected, userId: "user_2" })).toBe(false);
    expect(verifyOAuthState(null, expected)).toBe(false);
  });
});

describe("token responses", () => {
  it("keeps the previous refresh token when the provider omits it", () => {
    const before = Date.now();
    const t = parseTokenResponse({ access_token: "at", expires_in: 3600, scope: "a b" }, "old-rt", "Google Drive");
    expect(t.accessToken).toBe("at");
    expect(t.refreshToken).toBe("old-rt");
    expect(t.scopes).toBe("a b");
    expect(t.expiresAt!.getTime()).toBeGreaterThanOrEqual(before + 3600_000 - 50);
    expect(t.expiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 3600_000 + 50);
  });
  it("prefers a newly issued refresh token and tolerates a missing expiry", () => {
    const t = parseTokenResponse({ access_token: "at", refresh_token: "new-rt" }, "old-rt", "OneDrive");
    expect(t.refreshToken).toBe("new-rt");
    expect(t.expiresAt).toBeNull();
    expect(t.scopes).toBe("");
  });
  it("rejects responses without an access token", () => {
    expect(() => parseTokenResponse({ token_type: "Bearer" }, null, "Google Drive")).toThrow();
  });
  it("maps HTTP statuses to friendly error codes", () => {
    expect(errorFromStatus(401, "X").code).toBe("reconnect");
    expect(errorFromStatus(401, "X").status).toBe(401);
    expect(errorFromStatus(403, "X").code).toBe("permission");
    expect(errorFromStatus(404, "X").code).toBe("not_found");
    expect(errorFromStatus(429, "X").code).toBe("rate_limited");
    expect(errorFromStatus(500, "X").code).toBe("provider");
    expect(errorFromStatus(404, "X", "a.pdf").fileName).toBe("a.pdf");
  });
});

describe("file names", () => {
  it("derives titles by stripping a short extension", () => {
    expect(titleFromFileName("SOC 2 Report.pdf")).toBe("SOC 2 Report");
    expect(titleFromFileName("Information Security Policy")).toBe("Information Security Policy");
    expect(titleFromFileName("archive.tar.gz")).toBe("archive.tar");
    expect(titleFromFileName("v1.2 release notes")).toBe("v1.2 release notes");
    expect(titleFromFileName(".pdf")).toBe(".pdf");
    expect(titleFromFileName("   ")).toBe("Untitled");
  });
  it("names Google exports <name>.pdf and avoids doubled office extensions", () => {
    expect(googleExportFileName("Information Security Policy")).toBe("Information Security Policy.pdf");
    expect(googleExportFileName("Report.docx")).toBe("Report.pdf");
    expect(googleExportFileName("Budget.XLSX")).toBe("Budget.pdf");
    expect(googleExportFileName("Already.pdf")).toBe("Already.pdf");
    expect(googleExportFileName("Q3.2026 plan")).toBe("Q3.2026 plan.pdf");
    expect(googleExportFileName("")).toBe("document.pdf");
  });
});

describe("Google normalisation", () => {
  it("normalises files, folders and native documents", () => {
    expect(
      normalizeGoogleFile({ id: "1", name: "a.pdf", mimeType: "application/pdf", size: "1234", modifiedTime: "2026-01-01T00:00:00Z", webViewLink: "https://x" }),
    ).toEqual({ id: "1", name: "a.pdf", mimeType: "application/pdf", size: 1234, modifiedTime: "2026-01-01T00:00:00Z", isFolder: false, webUrl: "https://x" });
    const folder = normalizeGoogleFile({ id: "f", name: "Docs", mimeType: "application/vnd.google-apps.folder" });
    expect(folder.isFolder).toBe(true);
    expect(folder.size).toBeNull();
    expect(folder.webUrl).toBeNull();
    const doc = normalizeGoogleFile({ id: "d", mimeType: "application/vnd.google-apps.document" });
    expect(doc.name).toBe("Untitled");
    expect(isGoogleNative(doc.mimeType)).toBe(true);
    expect(isGoogleNative("application/pdf")).toBe(false);
  });
  it("builds safe files.list queries", () => {
    expect(buildGoogleQuery({})).toBe("'root' in parents and trashed = false");
    expect(buildGoogleQuery({ folderId: "abc" })).toBe("'abc' in parents and trashed = false");
    expect(buildGoogleQuery({ query: "soc 2" })).toBe("name contains 'soc 2' and trashed = false");
    expect(buildGoogleQuery({ folderId: "abc", query: "x" })).toBe("name contains 'x' and trashed = false");
    expect(escapeDriveQueryValue(`it's a \\ test`)).toBe(`it\\'s a \\\\ test`);
    expect(buildGoogleQuery({ query: "a' or '1'='1" })).toBe("name contains 'a\\' or \\'1\\'=\\'1' and trashed = false");
  });
});

describe("Microsoft normalisation", () => {
  it("normalises drive items", () => {
    expect(
      normalizeMicrosoftItem({ id: "1", name: "a.pdf", size: 10, lastModifiedDateTime: "2026-01-01T00:00:00Z", webUrl: "https://x", file: { mimeType: "application/pdf" } }),
    ).toEqual({ id: "1", name: "a.pdf", mimeType: "application/pdf", size: 10, modifiedTime: "2026-01-01T00:00:00Z", isFolder: false, webUrl: "https://x" });
    const folder = normalizeMicrosoftItem({ id: "f", name: "Docs", size: 999, folder: { childCount: 3 } });
    expect(folder.isFolder).toBe(true);
    expect(folder.size).toBeNull();
    expect(normalizeMicrosoftItem({ id: "n", name: "Notebook", package: { type: "oneNote" } }).mimeType).toBe("application/vnd.microsoft.package.oneNote");
    expect(normalizeMicrosoftItem({ id: "u", name: "blob", file: {} }).mimeType).toBe("application/octet-stream");
  });
  it("escapes search terms and validates next links", () => {
    expect(escapeGraphSearchTerm("it's")).toBe("it''s");
    const base = "https://graph.microsoft.com/v1.0";
    expect(isSafeGraphNextLink(`${base}/me/drive/root/children?$skiptoken=abc`, base)).toBe(true);
    expect(isSafeGraphNextLink(`${base}/me/messages`, base)).toBe(false);
    expect(isSafeGraphNextLink("https://evil.example/v1.0/me/drive/root/children", base)).toBe(false);
    expect(isSafeGraphNextLink("not a url", base)).toBe(false);
  });
});
