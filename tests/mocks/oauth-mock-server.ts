/**
 * Mock Google and Microsoft identity + file APIs for automated tests.
 *
 * Self-contained (node:http only) so Playwright's global setup and `pnpm tsx` can start it.
 * It mirrors the real protocol closely enough that the application code path is identical:
 *
 * Google (one server):
 *   GET  /o/oauth2/v2/auth               validates client_id, redirect_uri, response_type=code,
 *                                        scope (must include drive.readonly), state,
 *                                        code_challenge(+_method=S256) -> 302 redirect_uri?code&state
 *   POST /token                          grant_type=authorization_code (code single-use, client_id,
 *                                        client_secret, redirect_uri and PKCE verifier are checked)
 *                                        or grant_type=refresh_token (no new refresh token, like Google)
 *   POST /revoke                         200
 *   GET  /v1/userinfo                    { sub, email, name }
 *   GET  /drive/v3/files                 q: 'X' in parents | name contains 'Y' | trashed = false;
 *                                        pageSize, pageToken, orderBy=folder,name
 *   GET  /drive/v3/files/:id             metadata, or bytes with ?alt=media
 *   GET  /drive/v3/files/:id/export      PDF bytes for Google-native types
 *
 * Microsoft (one server):
 *   GET  /:tenant/oauth2/v2.0/authorize  same validations (scope must include Files.Read)
 *   POST /:tenant/oauth2/v2.0/token      same validations; refresh rotates the refresh token
 *   GET  /v1.0/me                        { id, displayName, mail, userPrincipalName }
 *   GET  /v1.0/me/drive/root/children, /v1.0/me/drive/items/:id/children   ($top, $skiptoken, @odata.nextLink)
 *   GET  /v1.0/me/drive/root/search(q='x'), /v1.0/me/drive/items/:id/search(q='x')
 *   GET  /v1.0/me/drive/items/:id        metadata
 *   GET  /v1.0/me/drive/items/:id/content  302 -> /download/:id (pre-authenticated, no bearer needed)
 *   GET  /download/:id                   bytes
 *
 * Every API endpoint rejects a missing/unknown/expired bearer token with 401.
 *
 * Test switches (both servers):
 *   - Authorize with `prompt=expired` or `login_hint=expired...` -> the code exchange issues an
 *     access token prefixed "expired-" that every API call rejects with 401, so the refresh path
 *     runs immediately. (The refresh grant always issues valid tokens.)
 *   - POST /__mock/expire   invalidates every access token issued so far (same effect, no re-auth).
 *   - POST /__mock/reset    clears codes, tokens and statistics.
 *   - GET  /__mock/stats    counters for assertions (code grants, refresh grants, rejected requests).
 *   - Env MOCK_GOOGLE_CLIENT_SECRET / MOCK_MICROSOFT_CLIENT_SECRET: when set, the token endpoint
 *     requires exactly that client secret (otherwise any non-empty secret is accepted).
 *
 * CLI: `pnpm tsx tests/mocks/oauth-mock-server.ts` starts Google on 4100 and Microsoft on 4200
 *      (override with MOCK_GOOGLE_PORT / MOCK_MICROSOFT_PORT).
 */
import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Provider = "google" | "microsoft";

type IssuedCode = {
  provider: Provider;
  clientId: string;
  redirectUri: string;
  challenge: string;
  scope: string;
  expired: boolean;
  used: boolean;
};
type AccessToken = { provider: Provider; scope: string; invalid: boolean };
type RefreshToken = { provider: Provider; scope: string; clientId: string };

const codes = new Map<string, IssuedCode>();
const accessTokens = new Map<string, AccessToken>();
const refreshTokens = new Map<string, RefreshToken>();

export type MockStats = {
  authorizeRequests: number;
  codeGrants: number;
  refreshGrants: number;
  revocations: number;
  apiRequests: number;
  unauthorized: number;
  rejected: string[];
  lastAuthorize: Record<string, string> | null;
};

function freshStats(): MockStats {
  return {
    authorizeRequests: 0,
    codeGrants: 0,
    refreshGrants: 0,
    revocations: 0,
    apiRequests: 0,
    unauthorized: 0,
    rejected: [],
    lastAuthorize: null,
  };
}

const stats: Record<Provider, MockStats> = { google: freshStats(), microsoft: freshStats() };

export function resetMockState() {
  codes.clear();
  accessTokens.clear();
  refreshTokens.clear();
  stats.google = freshStats();
  stats.microsoft = freshStats();
}

// ---------- Fixture bytes ----------

const PDF_BYTES = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj",
    "trailer << /Root 1 0 R >>",
    "%%EOF",
    "",
  ].join("\n"),
  "latin1",
);
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const EXE_BYTES = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(254, 0)]);
const TXT_BYTES = Buffer.from("Meeting notes\n- Rotate secrets quarterly\n", "utf8");
/** A structurally valid PDF padded with a comment to ~1.5 MB (exceeds a 1 MB test limit). */
const LARGE_PDF_BYTES = Buffer.concat([
  Buffer.from("%PDF-1.4\n%", "latin1"),
  Buffer.alloc(1_500_000, 0x41),
  Buffer.from("\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n", "latin1"),
]);

const FOLDER_MIME = "application/vnd.google-apps.folder";
const GDOC = "application/vnd.google-apps.document";
const GSHEET = "application/vnd.google-apps.spreadsheet";
const GSLIDES = "application/vnd.google-apps.presentation";
const GFORM = "application/vnd.google-apps.form";

type GFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime: string;
  parents: string[];
  bytes?: Buffer;
  trashed?: boolean;
  /** Bytes served by files.export (native types). */
  exportBytes?: Buffer;
};

function gfile(partial: Omit<GFile, "modifiedTime"> & { modifiedTime?: string }): GFile {
  return { modifiedTime: "2026-03-14T09:30:00.000Z", ...partial, size: partial.size ?? partial.bytes?.length };
}

const GOOGLE_FILES: GFile[] = [
  gfile({ id: "g-folder-compliance", name: "Compliance", mimeType: FOLDER_MIME, parents: ["root"], modifiedTime: "2026-05-02T08:00:00.000Z" }),
  gfile({ id: "g-folder-archive", name: "Archive", mimeType: FOLDER_MIME, parents: ["root"] }),
  gfile({ id: "g-pdf-soc2", name: "SOC 2 Type II Report.pdf", mimeType: "application/pdf", parents: ["root"], bytes: PDF_BYTES, modifiedTime: "2026-06-30T12:00:00.000Z" }),
  gfile({ id: "g-png-diagram", name: "Architecture diagram.png", mimeType: "image/png", parents: ["root"], bytes: PNG_BYTES }),
  gfile({ id: "g-doc-policy", name: "Information Security Policy", mimeType: GDOC, parents: ["root"], exportBytes: PDF_BYTES, modifiedTime: "2026-01-20T16:45:00.000Z" }),
  gfile({ id: "g-sheet-risk", name: "Risk register", mimeType: GSHEET, parents: ["root"], exportBytes: PDF_BYTES }),
  gfile({ id: "g-slides-large", name: "Board deck (large)", mimeType: GSLIDES, parents: ["root"], exportBytes: LARGE_PDF_BYTES }),
  gfile({ id: "g-form-survey", name: "Vendor survey", mimeType: GFORM, parents: ["root"] }),
  gfile({ id: "g-video-huge", name: "All-hands recording.mp4", mimeType: "video/mp4", size: 900 * 1024 * 1024, parents: ["root"] }),
  gfile({ id: "g-exe", name: "installer.exe", mimeType: "application/x-msdownload", parents: ["root"], bytes: EXE_BYTES }),
  gfile({ id: "g-trashed", name: "Old policy (trashed).pdf", mimeType: "application/pdf", parents: ["root"], bytes: PDF_BYTES, trashed: true }),
  gfile({ id: "g-pdf-pentest", name: "Penetration test 2026.pdf", mimeType: "application/pdf", parents: ["g-folder-compliance"], bytes: PDF_BYTES, modifiedTime: "2026-04-11T10:00:00.000Z" }),
  gfile({ id: "g-pdf-iso", name: "ISO 27001 certificate.pdf", mimeType: "application/pdf", parents: ["g-folder-compliance"], bytes: PDF_BYTES }),
  gfile({ id: "g-slides-overview", name: "Security overview", mimeType: GSLIDES, parents: ["g-folder-compliance"], exportBytes: PDF_BYTES }),
  ...Array.from({ length: 60 }, (_, i) =>
    gfile({
      id: `g-archive-${String(i + 1).padStart(2, "0")}`,
      name: `Policy archive ${String(i + 1).padStart(2, "0")}.pdf`,
      mimeType: "application/pdf",
      parents: ["g-folder-archive"],
      bytes: PDF_BYTES,
      modifiedTime: `2025-${String((i % 12) + 1).padStart(2, "0")}-01T00:00:00.000Z`,
    }),
  ),
];

type MItem = {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime: string;
  parentId: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  package?: { type: string };
  bytes?: Buffer;
};

function mitem(partial: Omit<MItem, "lastModifiedDateTime"> & { lastModifiedDateTime?: string }): MItem {
  return { lastModifiedDateTime: "2026-03-14T09:30:00Z", ...partial, size: partial.size ?? partial.bytes?.length ?? 0 };
}

const MS_ITEMS: MItem[] = [
  mitem({ id: "m-folder-compliance", name: "Compliance", parentId: "root", folder: { childCount: 2 } }),
  mitem({ id: "m-folder-archive", name: "Archive", parentId: "root", folder: { childCount: 60 } }),
  mitem({ id: "m-pdf-soc2", name: "SOC 2 Type II Report.pdf", parentId: "root", file: { mimeType: "application/pdf" }, bytes: PDF_BYTES, lastModifiedDateTime: "2026-06-30T12:00:00Z" }),
  mitem({ id: "m-png-diagram", name: "Architecture diagram.png", parentId: "root", file: { mimeType: "image/png" }, bytes: PNG_BYTES }),
  mitem({ id: "m-txt-notes", name: "Security notes.txt", parentId: "root", file: { mimeType: "text/plain" }, bytes: TXT_BYTES }),
  mitem({ id: "m-onenote", name: "Team notebook", parentId: "root", package: { type: "oneNote" } }),
  mitem({ id: "m-pdf-large", name: "Audit evidence (large).pdf", parentId: "root", file: { mimeType: "application/pdf" }, bytes: LARGE_PDF_BYTES }),
  mitem({ id: "m-exe", name: "installer.exe", parentId: "root", file: { mimeType: "application/x-msdownload" }, bytes: EXE_BYTES }),
  mitem({ id: "m-pdf-pentest", name: "Penetration test 2026.pdf", parentId: "m-folder-compliance", file: { mimeType: "application/pdf" }, bytes: PDF_BYTES, lastModifiedDateTime: "2026-04-11T10:00:00Z" }),
  mitem({ id: "m-pdf-iso", name: "ISO 27001 certificate.pdf", parentId: "m-folder-compliance", file: { mimeType: "application/pdf" }, bytes: PDF_BYTES }),
  ...Array.from({ length: 60 }, (_, i) =>
    mitem({
      id: `m-archive-${String(i + 1).padStart(2, "0")}`,
      name: `Policy archive ${String(i + 1).padStart(2, "0")}.pdf`,
      parentId: "m-folder-archive",
      file: { mimeType: "application/pdf" },
      bytes: PDF_BYTES,
    }),
  ),
];

// ---------- Helpers ----------

function s256(verifier: string) {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

function token(prefix = "") {
  return `${prefix}${randomBytes(24).toString("base64url")}`;
}

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload), ...headers });
  res.end(payload);
}

function text(res: http.ServerResponse, status: number, body: string) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function bytes(res: http.ServerResponse, body: Buffer, contentType: string) {
  res.writeHead(200, { "Content-Type": contentType, "Content-Length": body.length });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function reject(provider: Provider, reason: string) {
  stats[provider].rejected.push(reason);
  return reason;
}

function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Shared /authorize validation. Returns the redirect location or an error message. */
function handleAuthorize(provider: Provider, url: URL, requiredScope: string): { redirect: string } | { error: string } {
  const p = url.searchParams;
  stats[provider].authorizeRequests += 1;
  stats[provider].lastAuthorize = Object.fromEntries(p.entries());
  const clientId = p.get("client_id") ?? "";
  const redirectUri = p.get("redirect_uri") ?? "";
  const state = p.get("state") ?? "";
  const scope = p.get("scope") ?? "";
  const challenge = p.get("code_challenge") ?? "";
  if (!clientId) return { error: reject(provider, "authorize: missing client_id") };
  if (!isHttpUrl(redirectUri)) return { error: reject(provider, "authorize: invalid redirect_uri") };
  if (p.get("response_type") !== "code") return { error: reject(provider, "authorize: response_type must be code") };
  if (!scope.split(/\s+/).includes(requiredScope)) return { error: reject(provider, `authorize: scope must include ${requiredScope}`) };
  if (!state) return { error: reject(provider, "authorize: missing state") };
  if (p.get("code_challenge_method") !== "S256") return { error: reject(provider, "authorize: code_challenge_method must be S256") };
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) return { error: reject(provider, "authorize: invalid code_challenge") };
  if (provider === "microsoft" && p.get("response_mode") && p.get("response_mode") !== "query") {
    return { error: reject(provider, "authorize: response_mode must be query") };
  }
  const expired = p.get("prompt") === "expired" || (p.get("login_hint") ?? "").startsWith("expired");
  // Simulated user decision: deny when asked to.
  if ((p.get("login_hint") ?? "").startsWith("deny")) {
    const back = new URL(redirectUri);
    back.searchParams.set("error", "access_denied");
    back.searchParams.set("state", state);
    return { redirect: back.toString() };
  }
  const code = token("code-");
  codes.set(code, { provider, clientId, redirectUri, challenge, scope, expired, used: false });
  const back = new URL(redirectUri);
  back.searchParams.set("code", code);
  back.searchParams.set("state", state);
  if (provider === "microsoft") back.searchParams.set("session_state", token());
  return { redirect: back.toString() };
}

/** Shared /token handling. */
async function handleToken(provider: Provider, req: http.IncomingMessage, res: http.ServerResponse) {
  const form = new URLSearchParams(await readBody(req));
  if (!(req.headers["content-type"] ?? "").includes("application/x-www-form-urlencoded")) {
    return json(res, 400, { error: "invalid_request", error_description: reject(provider, "token: body must be form-encoded") });
  }
  const grant = form.get("grant_type");
  const clientId = form.get("client_id") ?? "";
  const clientSecret = form.get("client_secret") ?? "";
  const requiredSecret = process.env[provider === "google" ? "MOCK_GOOGLE_CLIENT_SECRET" : "MOCK_MICROSOFT_CLIENT_SECRET"];
  if (!clientId || !clientSecret || (requiredSecret && clientSecret !== requiredSecret)) {
    return json(res, 401, { error: "invalid_client", error_description: reject(provider, "token: bad client credentials") });
  }

  if (grant === "authorization_code") {
    const code = codes.get(form.get("code") ?? "");
    if (!code || code.provider !== provider || code.used) {
      return json(res, 400, { error: "invalid_grant", error_description: reject(provider, "token: unknown or used code") });
    }
    code.used = true;
    if (code.clientId !== clientId) return json(res, 400, { error: "invalid_grant", error_description: reject(provider, "token: client_id mismatch") });
    if ((form.get("redirect_uri") ?? "") !== code.redirectUri) {
      return json(res, 400, { error: "invalid_grant", error_description: reject(provider, "token: redirect_uri mismatch") });
    }
    const verifier = form.get("code_verifier") ?? "";
    if (!verifier || s256(verifier) !== code.challenge) {
      return json(res, 400, { error: "invalid_grant", error_description: reject(provider, "token: code_verifier does not match code_challenge") });
    }
    stats[provider].codeGrants += 1;
    const access = token(code.expired ? "expired-" : "at-");
    const refresh = token("rt-");
    accessTokens.set(access, { provider, scope: code.scope, invalid: code.expired });
    refreshTokens.set(refresh, { provider, scope: code.scope, clientId });
    const scope = provider === "microsoft" ? code.scope.split(/\s+/).filter((s) => s !== "offline_access").join(" ") : code.scope;
    return json(res, 200, { access_token: access, refresh_token: refresh, expires_in: 3600, scope, token_type: "Bearer" });
  }

  if (grant === "refresh_token") {
    const refresh = refreshTokens.get(form.get("refresh_token") ?? "");
    if (!refresh || refresh.provider !== provider) {
      return json(res, 400, { error: "invalid_grant", error_description: reject(provider, "token: unknown refresh token") });
    }
    if (refresh.clientId !== clientId) return json(res, 400, { error: "invalid_grant", error_description: reject(provider, "token: client_id mismatch") });
    stats[provider].refreshGrants += 1;
    const access = token("at-");
    accessTokens.set(access, { provider, scope: refresh.scope, invalid: false });
    const body: Record<string, unknown> = { access_token: access, expires_in: 3600, scope: refresh.scope, token_type: "Bearer" };
    if (provider === "microsoft") {
      const rotated = token("rt-");
      refreshTokens.set(rotated, refresh);
      body.refresh_token = rotated;
      body.scope = refresh.scope.split(/\s+/).filter((s) => s !== "offline_access").join(" ");
    }
    return json(res, 200, body);
  }

  return json(res, 400, { error: "unsupported_grant_type", error_description: reject(provider, `token: grant_type ${grant}`) });
}

function bearer(provider: Provider, req: http.IncomingMessage, res: http.ServerResponse): AccessToken | null {
  stats[provider].apiRequests += 1;
  const header = req.headers.authorization ?? "";
  const value = header.startsWith("Bearer ") ? header.slice(7) : "";
  const record = accessTokens.get(value);
  if (!value || !record || record.provider !== provider || record.invalid || value.startsWith("expired-")) {
    stats[provider].unauthorized += 1;
    if (provider === "google") {
      json(res, 401, { error: { code: 401, message: "Request had invalid authentication credentials.", status: "UNAUTHENTICATED" } }, { "WWW-Authenticate": 'Bearer realm="https://accounts.google.com/"' });
    } else {
      json(res, 401, { error: { code: "InvalidAuthenticationToken", message: "Access token has expired or is not yet valid." } }, { "WWW-Authenticate": 'Bearer realm="", authorization_uri="https://login.microsoftonline.com/common/oauth2/authorize"' });
    }
    return null;
  }
  return record;
}

function handleControl(provider: Provider, url: URL, req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (!url.pathname.startsWith("/__mock/")) return false;
  if (url.pathname === "/__mock/stats") {
    json(res, 200, { ...stats[provider], accessTokens: accessTokens.size, refreshTokens: refreshTokens.size });
  } else if (url.pathname === "/__mock/expire" && req.method === "POST") {
    let n = 0;
    for (const t of accessTokens.values()) {
      if (t.provider === provider && !t.invalid) {
        t.invalid = true;
        n += 1;
      }
    }
    json(res, 200, { expired: n });
  } else if (url.pathname === "/__mock/reset" && req.method === "POST") {
    resetMockState();
    json(res, 200, { ok: true });
  } else {
    text(res, 404, "Unknown mock control endpoint");
  }
  return true;
}

// ---------- Google ----------

function parseDriveQuery(q: string): { parent: string | null; nameContains: string | null; excludeTrashed: boolean } {
  const unescape = (v: string) => v.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  const parent = /'((?:[^'\\]|\\.)*)'\s+in\s+parents/i.exec(q);
  const name = /name\s+contains\s+'((?:[^'\\]|\\.)*)'/i.exec(q);
  return {
    parent: parent ? unescape(parent[1]) : null,
    nameContains: name ? unescape(name[1]) : null,
    excludeTrashed: /trashed\s*=\s*false/i.test(q),
  };
}

function googleMeta(f: GFile) {
  const meta: Record<string, unknown> = {
    kind: "drive#file",
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink: f.mimeType === FOLDER_MIME ? `https://drive.google.com/drive/folders/${f.id}` : `https://drive.google.com/file/d/${f.id}/view`,
    parents: f.parents,
    trashed: Boolean(f.trashed),
  };
  // Drive returns size as a string and omits it for folders and native documents.
  if (f.size !== undefined && f.mimeType !== FOLDER_MIME && !f.mimeType.startsWith("application/vnd.google-apps.")) meta.size = String(f.size);
  return meta;
}

async function googleHandler(port: number, req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const p = url.pathname;
  try {
    if (handleControl("google", url, req, res)) return;

    if (req.method === "GET" && p === "/o/oauth2/v2/auth") {
      const out = handleAuthorize("google", url, "https://www.googleapis.com/auth/drive.readonly");
      if ("error" in out) return text(res, 400, `Error 400: invalid_request\n${out.error}`);
      res.writeHead(302, { Location: out.redirect });
      return res.end();
    }
    if (req.method === "POST" && p === "/token") return handleToken("google", req, res);
    if (req.method === "POST" && p === "/revoke") {
      const form = new URLSearchParams(await readBody(req));
      const t = form.get("token") ?? url.searchParams.get("token") ?? "";
      stats.google.revocations += 1;
      if (refreshTokens.delete(t) || accessTokens.delete(t)) return json(res, 200, {});
      return json(res, 400, { error: "invalid_token" });
    }

    if (req.method === "GET" && p === "/v1/userinfo") {
      if (!bearer("google", req, res)) return;
      return json(res, 200, { sub: "1234567890", email: "security@example.com", email_verified: true, name: "Example Security Team", picture: "" });
    }

    if (req.method === "GET" && p === "/drive/v3/files") {
      if (!bearer("google", req, res)) return;
      const q = parseDriveQuery(url.searchParams.get("q") ?? "");
      let list = GOOGLE_FILES.filter((f) => {
        if (q.excludeTrashed && f.trashed) return false;
        if (q.parent && !f.parents.includes(q.parent)) return false;
        if (q.nameContains && !f.name.toLowerCase().includes(q.nameContains.toLowerCase())) return false;
        return true;
      });
      if ((url.searchParams.get("orderBy") ?? "").includes("folder")) {
        list = [...list].sort((a, b) => (a.mimeType === FOLDER_MIME ? 0 : 1) - (b.mimeType === FOLDER_MIME ? 0 : 1) || a.name.localeCompare(b.name));
      }
      const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") ?? 100) || 100, 1), 1000);
      const offset = Number(url.searchParams.get("pageToken") ?? 0) || 0;
      const page = list.slice(offset, offset + pageSize);
      const body: Record<string, unknown> = { kind: "drive#fileList", incompleteSearch: false, files: page.map(googleMeta) };
      if (offset + pageSize < list.length) body.nextPageToken = String(offset + pageSize);
      return json(res, 200, body);
    }

    const exportMatch = /^\/drive\/v3\/files\/([^/]+)\/export$/.exec(p);
    if (req.method === "GET" && exportMatch) {
      if (!bearer("google", req, res)) return;
      const f = GOOGLE_FILES.find((x) => x.id === decodeURIComponent(exportMatch[1]));
      if (!f) return json(res, 404, { error: { code: 404, message: "File not found", status: "NOT_FOUND" } });
      if (!f.exportBytes) return json(res, 403, { error: { code: 403, message: "Export only supports Docs Editors files.", status: "PERMISSION_DENIED" } });
      if (url.searchParams.get("mimeType") !== "application/pdf") return json(res, 400, { error: { code: 400, message: "The requested conversion is not supported.", status: "INVALID_ARGUMENT" } });
      return bytes(res, f.exportBytes, "application/pdf");
    }

    const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(p);
    if (req.method === "GET" && fileMatch) {
      if (!bearer("google", req, res)) return;
      const f = GOOGLE_FILES.find((x) => x.id === decodeURIComponent(fileMatch[1]));
      if (!f) return json(res, 404, { error: { code: 404, message: "File not found", status: "NOT_FOUND" } });
      if (url.searchParams.get("alt") === "media") {
        if (f.mimeType.startsWith("application/vnd.google-apps.")) {
          return json(res, 403, { error: { code: 403, message: "Only files with binary content can be downloaded. Use Export with Docs Editors files.", status: "PERMISSION_DENIED" } });
        }
        return bytes(res, f.bytes ?? Buffer.alloc(Math.min(f.size ?? 0, 2 * 1024 * 1024)), f.mimeType);
      }
      return json(res, 200, googleMeta(f));
    }

    return json(res, 404, { error: { code: 404, message: `Mock: no route for ${req.method} ${p}`, status: "NOT_FOUND" } });
  } catch (err) {
    text(res, 500, `Mock error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------- Microsoft ----------

function msMeta(port: number, item: MItem) {
  const meta: Record<string, unknown> = {
    id: item.id,
    name: item.name,
    size: item.size ?? 0,
    lastModifiedDateTime: item.lastModifiedDateTime,
    createdDateTime: "2025-01-01T00:00:00Z",
    webUrl: `https://onedrive.live.com/?id=${encodeURIComponent(item.id)}`,
    parentReference: { driveId: "drive-1", id: item.parentId, path: "/drive/root:" },
  };
  if (item.folder) meta.folder = item.folder;
  if (item.file) {
    meta.file = { mimeType: item.file.mimeType, hashes: {} };
    meta["@microsoft.graph.downloadUrl"] = `http://127.0.0.1:${port}/download/${encodeURIComponent(item.id)}`;
  }
  if (item.package) meta.package = item.package;
  return meta;
}

function msPage(port: number, res: http.ServerResponse, url: URL, items: MItem[], basePath: string) {
  const top = Math.min(Math.max(Number(url.searchParams.get("$top") ?? 200) || 200, 1), 1000);
  const skip = Number(url.searchParams.get("$skiptoken") ?? 0) || 0;
  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const page = sorted.slice(skip, skip + top);
  const body: Record<string, unknown> = { "@odata.context": `http://127.0.0.1:${port}/v1.0/$metadata#driveItems`, value: page.map((i) => msMeta(port, i)) };
  if (skip + top < sorted.length) {
    const next = new URL(`http://127.0.0.1:${port}${basePath}`);
    next.searchParams.set("$top", String(top));
    next.searchParams.set("$skiptoken", String(skip + top));
    const select = url.searchParams.get("$select");
    if (select) next.searchParams.set("$select", select);
    body["@odata.nextLink"] = next.toString();
  }
  return json(res, 200, body);
}

async function microsoftHandler(port: number, req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  const p = decodeURIComponent(url.pathname);
  try {
    if (handleControl("microsoft", url, req, res)) return;

    const authMatch = /^\/([^/]+)\/oauth2\/v2\.0\/authorize$/.exec(p);
    if (req.method === "GET" && authMatch) {
      const out = handleAuthorize("microsoft", url, "Files.Read");
      if ("error" in out) return text(res, 400, `AADSTS900144: ${out.error}`);
      res.writeHead(302, { Location: out.redirect });
      return res.end();
    }
    const tokenMatch = /^\/([^/]+)\/oauth2\/v2\.0\/token$/.exec(p);
    if (req.method === "POST" && tokenMatch) return handleToken("microsoft", req, res);

    if (req.method === "GET" && p.startsWith("/download/")) {
      const item = MS_ITEMS.find((x) => x.id === p.slice("/download/".length));
      if (!item || !item.file) return text(res, 404, "Not found");
      return bytes(res, item.bytes ?? Buffer.alloc(Math.min(item.size ?? 0, 2 * 1024 * 1024)), item.file.mimeType);
    }

    if (!p.startsWith("/v1.0/")) return json(res, 404, { error: { code: "itemNotFound", message: `Mock: no route for ${req.method} ${p}` } });
    if (!bearer("microsoft", req, res)) return;

    if (req.method === "GET" && p === "/v1.0/me") {
      return json(res, 200, { id: "user-1", displayName: "Example Security Team", mail: "security@example.com", userPrincipalName: "security@example.com", givenName: "Security", surname: "Team" });
    }
    if (req.method === "GET" && p === "/v1.0/me/drive/root/children") {
      return msPage(port, res, url, MS_ITEMS.filter((i) => i.parentId === "root"), "/v1.0/me/drive/root/children");
    }
    const childrenMatch = /^\/v1\.0\/me\/drive\/items\/([^/]+)\/children$/.exec(p);
    if (req.method === "GET" && childrenMatch) {
      const folder = MS_ITEMS.find((i) => i.id === childrenMatch[1]);
      if (!folder) return json(res, 404, { error: { code: "itemNotFound", message: "The resource could not be found." } });
      return msPage(port, res, url, MS_ITEMS.filter((i) => i.parentId === folder.id), `/v1.0/me/drive/items/${encodeURIComponent(folder.id)}/children`);
    }
    const searchMatch = /^\/v1\.0\/me\/drive\/(?:root|items\/([^/]+))\/search\(q='(.*)'\)$/.exec(p);
    if (req.method === "GET" && searchMatch) {
      const term = searchMatch[2].replace(/''/g, "'").toLowerCase();
      const scope = searchMatch[1] ?? null;
      const inScope = (i: MItem): boolean => {
        if (!scope) return true;
        let cur: MItem | undefined = i;
        while (cur) {
          if (cur.parentId === scope) return true;
          cur = MS_ITEMS.find((x) => x.id === cur!.parentId);
        }
        return false;
      };
      const hits = MS_ITEMS.filter((i) => inScope(i) && (term === "" || i.name.toLowerCase().includes(term)));
      return msPage(port, res, url, hits, `/v1.0/me/drive/root/search(q='${searchMatch[2]}')`);
    }
    const contentMatch = /^\/v1\.0\/me\/drive\/items\/([^/]+)\/content$/.exec(p);
    if (req.method === "GET" && contentMatch) {
      const item = MS_ITEMS.find((i) => i.id === contentMatch[1]);
      if (!item) return json(res, 404, { error: { code: "itemNotFound", message: "The resource could not be found." } });
      if (!item.file) return json(res, 400, { error: { code: "invalidRequest", message: "Content is not available for this item." } });
      res.writeHead(302, { Location: `http://127.0.0.1:${port}/download/${encodeURIComponent(item.id)}` });
      return res.end();
    }
    const itemMatch = /^\/v1\.0\/me\/drive\/items\/([^/]+)$/.exec(p);
    if (req.method === "GET" && itemMatch) {
      const item = MS_ITEMS.find((i) => i.id === itemMatch[1]);
      if (!item) return json(res, 404, { error: { code: "itemNotFound", message: "The resource could not be found." } });
      return json(res, 200, msMeta(port, item));
    }
    if (req.method === "GET" && p === "/v1.0/me/drive/root") {
      return json(res, 200, { id: "root", name: "root", folder: { childCount: MS_ITEMS.filter((i) => i.parentId === "root").length } });
    }
    return json(res, 404, { error: { code: "itemNotFound", message: `Mock: no route for ${req.method} ${p}` } });
  } catch (err) {
    text(res, 500, `Mock error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------- Lifecycle ----------

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(() => resolve());
  });
}

export type MockProviders = {
  google: { port: number; url: string };
  microsoft: { port: number; url: string };
  stop: () => Promise<void>;
};

export async function startMockProviders({ googlePort, microsoftPort }: { googlePort: number; microsoftPort: number }): Promise<MockProviders> {
  resetMockState();
  const google = http.createServer((req, res) => void googleHandler(googlePort, req, res));
  const microsoft = http.createServer((req, res) => void microsoftHandler(microsoftPort, req, res));
  await listen(google, googlePort);
  await listen(microsoft, microsoftPort);
  return {
    google: { port: googlePort, url: `http://127.0.0.1:${googlePort}` },
    microsoft: { port: microsoftPort, url: `http://127.0.0.1:${microsoftPort}` },
    stop: async () => {
      await Promise.all([close(google), close(microsoft)]);
    },
  };
}

const isMain = process.argv[1] ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href : false;
if (isMain) {
  const googlePort = Number(process.env.MOCK_GOOGLE_PORT ?? 4100);
  const microsoftPort = Number(process.env.MOCK_MICROSOFT_PORT ?? 4200);
  startMockProviders({ googlePort, microsoftPort })
    .then((mocks) => {
      console.log(`Mock Google OAuth/Drive:        ${mocks.google.url}`);
      console.log(`Mock Microsoft identity/Graph:  ${mocks.microsoft.url}`);
      console.log("Control: POST /__mock/expire, POST /__mock/reset, GET /__mock/stats");
      const shutdown = () => void mocks.stop().then(() => process.exit(0));
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
