import { env, googleConfigured } from "../env";
import {
  IntegrationError,
  fetchBytes,
  fetchJson,
  friendlyMessage,
  parseTokenResponse,
  postForm,
  qs,
} from "./oauth";
import type { Account, DownloadedFile, ListOptions, ListResult, ProviderClient, RemoteFile, TokenSet } from "./types";

const LABEL = "Google Drive";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

export const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";

/** Google-native types that can be exported, and the format we export them to. */
export const GOOGLE_EXPORTABLE: Record<string, { mimeType: string; ext: string }> = {
  "application/vnd.google-apps.document": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.spreadsheet": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.presentation": { mimeType: "application/pdf", ext: "pdf" },
  "application/vnd.google-apps.drawing": { mimeType: "application/pdf", ext: "pdf" },
};

export function isGoogleNative(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.");
}

/**
 * Name of the exported file: "Security Policy" -> "Security Policy.pdf",
 * "Report.docx" (a Word file converted to a Google Doc) -> "Report.pdf".
 */
export function googleExportFileName(name: string, ext = "pdf"): string {
  const base = name
    .trim()
    .replace(/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|txt|csv|html?|gdoc|gsheet|gslides|pdf)$/i, "");
  return `${base || "document"}.${ext}`;
}

/** Escapes a value for use inside single quotes in a Drive `q` expression. */
export function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Builds the `q` parameter for files.list: a drive-wide name search, or a folder listing. */
export function buildGoogleQuery(options: Pick<ListOptions, "folderId" | "query">): string {
  const query = options.query?.trim();
  if (query) return `name contains '${escapeDriveQueryValue(query)}' and trashed = false`;
  const folder = options.folderId?.trim() || "root";
  return `'${escapeDriveQueryValue(folder)}' in parents and trashed = false`;
}

export type GoogleFile = {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string | number;
  modifiedTime?: string;
  webViewLink?: string;
};

export function normalizeGoogleFile(file: GoogleFile): RemoteFile {
  const mimeType = file.mimeType ?? "application/octet-stream";
  const size = file.size === undefined || file.size === null || file.size === "" ? NaN : Number(file.size);
  return {
    id: file.id,
    name: file.name ?? "Untitled",
    mimeType,
    size: Number.isFinite(size) ? size : null,
    modifiedTime: file.modifiedTime ?? null,
    isFolder: mimeType === GOOGLE_FOLDER_MIME,
    webUrl: file.webViewLink ?? null,
  };
}

const FILE_FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink";

function urls() {
  const e = env();
  const oauth = e.GOOGLE_OAUTH_BASE_URL?.replace(/\/+$/, "");
  const api = e.GOOGLE_API_BASE_URL?.replace(/\/+$/, "");
  return {
    authorize: oauth ? `${oauth}/o/oauth2/v2/auth` : "https://accounts.google.com/o/oauth2/v2/auth",
    token: oauth ? `${oauth}/token` : "https://oauth2.googleapis.com/token",
    revoke: oauth ? `${oauth}/revoke` : "https://oauth2.googleapis.com/revoke",
    userinfo: api ? `${api}/v1/userinfo` : "https://openidconnect.googleapis.com/v1/userinfo",
    drive: api ? `${api}/drive/v3` : "https://www.googleapis.com/drive/v3",
  };
}

function credentials() {
  const e = env();
  if (!e.GOOGLE_CLIENT_ID || !e.GOOGLE_CLIENT_SECRET) {
    throw new IntegrationError("not_configured", friendlyMessage("not_configured", LABEL), 404);
  }
  return { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET };
}

function redirectUri() {
  return `${env().APP_URL.replace(/\/+$/, "")}/api/integrations/google/callback`;
}

export const googleClient: ProviderClient = {
  key: "google",
  label: LABEL,
  dbProvider: "GOOGLE_DRIVE",
  documentSource: "GOOGLE_DRIVE",
  scopes: GOOGLE_SCOPES,
  scopeDescriptions: [
    "See the name and email address of the connected Google account",
    "Read-only access to files you choose to import; nothing in Drive is ever changed or deleted",
  ],
  docsPath: "docs/integrations/google-drive.md",

  configured: googleConfigured,
  redirectUri,

  authUrl({ state, codeChallenge }) {
    const { clientId } = credentials();
    return `${urls().authorize}?${qs({
      client_id: clientId,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      access_type: "offline",
      // Force the consent screen so a refresh token is issued on every (re)connect.
      prompt: "consent",
      include_granted_scopes: "true",
    })}`;
  },

  async exchangeCode({ code, codeVerifier }): Promise<TokenSet> {
    const { clientId, clientSecret } = credentials();
    const json = await postForm(
      urls().token,
      {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri(),
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      },
      LABEL,
    );
    return parseTokenResponse(json, null, LABEL);
  },

  async refresh(refreshToken): Promise<TokenSet> {
    const { clientId, clientSecret } = credentials();
    const json = await postForm(
      urls().token,
      { client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" },
      LABEL,
    );
    return parseTokenResponse(json, refreshToken, LABEL);
  },

  async getAccount(accessToken): Promise<Account> {
    const info = await fetchJson<{ email?: string; name?: string; sub?: string }>(urls().userinfo, accessToken, LABEL);
    return { email: info.email ?? "", name: info.name ?? info.email ?? "" };
  },

  async listFiles(accessToken, options): Promise<ListResult> {
    const params = qs({
      q: buildGoogleQuery(options),
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: Math.min(Math.max(options.pageSize ?? 50, 1), 100),
      orderBy: "folder,name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      spaces: "drive",
      pageToken: options.pageToken ?? undefined,
    });
    const json = await fetchJson<{ files?: GoogleFile[]; nextPageToken?: string }>(
      `${urls().drive}/files?${params}`,
      accessToken,
      LABEL,
    );
    return { files: (json.files ?? []).map(normalizeGoogleFile), nextPageToken: json.nextPageToken ?? null };
  },

  async getFile(accessToken, id): Promise<RemoteFile> {
    const json = await fetchJson<GoogleFile>(
      `${urls().drive}/files/${encodeURIComponent(id)}?${qs({ fields: FILE_FIELDS, supportsAllDrives: "true" })}`,
      accessToken,
      LABEL,
    );
    return normalizeGoogleFile(json);
  },

  async downloadFile(accessToken, id, { maxBytes }): Promise<DownloadedFile> {
    const meta = await this.getFile(accessToken, id);
    const base = {
      externalId: meta.id,
      externalUrl: meta.webUrl,
      modifiedTime: meta.modifiedTime ? new Date(meta.modifiedTime) : null,
    };
    if (meta.isFolder) {
      throw new IntegrationError("unsupported", "Folders cannot be imported. Open the folder and select files inside it.", 400, meta.name);
    }
    if (isGoogleNative(meta.mimeType)) {
      const target = GOOGLE_EXPORTABLE[meta.mimeType];
      if (!target) {
        throw new IntegrationError("unsupported", "This Google item type cannot be exported as a document.", 400, meta.name);
      }
      const fileName = googleExportFileName(meta.name, target.ext);
      const { buffer } = await fetchBytes(
        `${urls().drive}/files/${encodeURIComponent(id)}/export?${qs({ mimeType: target.mimeType })}`,
        accessToken,
        maxBytes,
        LABEL,
        fileName,
      );
      return { ...base, buffer, fileName, mimeType: target.mimeType };
    }
    if (meta.size !== null && meta.size > maxBytes) {
      throw new IntegrationError(
        "too_large",
        `The file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`,
        413,
        meta.name,
      );
    }
    const { buffer } = await fetchBytes(
      `${urls().drive}/files/${encodeURIComponent(id)}?${qs({ alt: "media", supportsAllDrives: "true" })}`,
      accessToken,
      maxBytes,
      LABEL,
      meta.name,
    );
    return { ...base, buffer, fileName: meta.name, mimeType: meta.mimeType };
  },

  async revoke({ accessToken, refreshToken }) {
    // Revoking the refresh token also invalidates access tokens issued from it.
    const token = refreshToken ?? accessToken;
    const res = await fetch(urls().revoke, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.warn(`[integrations] Google revoke responded ${res.status}`);
  },
};
