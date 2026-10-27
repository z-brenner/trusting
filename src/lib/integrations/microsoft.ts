import { env, microsoftConfigured } from "../env";
import {
  IntegrationError,
  errorFromStatus,
  fetchJson,
  friendlyMessage,
  parseTokenResponse,
  postForm,
  qs,
  readBodyWithLimit,
} from "./oauth";
import type { Account, DownloadedFile, ListResult, ProviderClient, RemoteFile, TokenSet } from "./types";

const LABEL = "OneDrive";

/** Delegated Microsoft Graph permissions. `offline_access` yields a refresh token. */
export const MICROSOFT_SCOPES = ["offline_access", "User.Read", "Files.Read"] as const;

export const MICROSOFT_FOLDER_MIME = "application/x-directory";

const ITEM_SELECT = "id,name,size,lastModifiedDateTime,webUrl,file,folder,package";

export type GraphDriveItem = {
  id: string;
  name?: string;
  size?: number;
  lastModifiedDateTime?: string;
  webUrl?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  package?: { type?: string };
};

export function normalizeMicrosoftItem(item: GraphDriveItem): RemoteFile {
  const isFolder = Boolean(item.folder);
  return {
    id: item.id,
    name: item.name ?? "Untitled",
    mimeType: isFolder
      ? MICROSOFT_FOLDER_MIME
      : item.package
        ? `application/vnd.microsoft.package.${item.package.type ?? "unknown"}`
        : item.file?.mimeType || "application/octet-stream",
    size: typeof item.size === "number" && Number.isFinite(item.size) && !isFolder ? item.size : null,
    modifiedTime: item.lastModifiedDateTime ?? null,
    isFolder,
    webUrl: item.webUrl ?? null,
  };
}

/** Escapes a search term for the `search(q='…')` function (single quotes are doubled). */
export function escapeGraphSearchTerm(term: string): string {
  return term.replace(/'/g, "''");
}

function urls() {
  const e = env();
  const oauth = (e.MICROSOFT_OAUTH_BASE_URL ?? "https://login.microsoftonline.com").replace(/\/+$/, "");
  const graph = (e.MICROSOFT_GRAPH_BASE_URL ?? "https://graph.microsoft.com").replace(/\/+$/, "");
  const tenant = encodeURIComponent(e.MICROSOFT_TENANT || "common");
  return {
    authorize: `${oauth}/${tenant}/oauth2/v2.0/authorize`,
    token: `${oauth}/${tenant}/oauth2/v2.0/token`,
    graph: `${graph}/v1.0`,
  };
}

function credentials() {
  const e = env();
  if (!e.MICROSOFT_CLIENT_ID || !e.MICROSOFT_CLIENT_SECRET) {
    throw new IntegrationError("not_configured", friendlyMessage("not_configured", LABEL), 404);
  }
  return { clientId: e.MICROSOFT_CLIENT_ID, clientSecret: e.MICROSOFT_CLIENT_SECRET };
}

function redirectUri() {
  return `${env().APP_URL.replace(/\/+$/, "")}/api/integrations/microsoft/callback`;
}

/**
 * Graph paginates with an absolute `@odata.nextLink`. We hand it to the client as the
 * page token and only accept it back when it points at our own Graph base URL.
 */
export function isSafeGraphNextLink(link: string, graphBase: string): boolean {
  try {
    const u = new URL(link);
    const base = new URL(graphBase);
    return u.origin === base.origin && u.pathname.startsWith(`${base.pathname.replace(/\/+$/, "")}/me/drive`);
  } catch {
    return false;
  }
}

export const microsoftClient: ProviderClient = {
  key: "microsoft",
  label: LABEL,
  dbProvider: "ONEDRIVE",
  documentSource: "ONEDRIVE",
  scopes: MICROSOFT_SCOPES,
  scopeDescriptions: [
    "See the name and email address of the connected Microsoft account",
    "Read-only access to files you choose to import; nothing in OneDrive is ever changed or deleted",
    "Stay connected without signing in again (offline access)",
  ],
  docsPath: "docs/integrations/onedrive.md",

  configured: microsoftConfigured,
  redirectUri,

  authUrl({ state, codeChallenge }) {
    const { clientId } = credentials();
    return `${urls().authorize}?${qs({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri(),
      response_mode: "query",
      scope: MICROSOFT_SCOPES.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    })}`;
  },

  async exchangeCode({ code, codeVerifier }): Promise<TokenSet> {
    const { clientId, clientSecret } = credentials();
    const json = await postForm(
      urls().token,
      {
        client_id: clientId,
        client_secret: clientSecret,
        scope: MICROSOFT_SCOPES.join(" "),
        code,
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
      {
        client_id: clientId,
        client_secret: clientSecret,
        scope: MICROSOFT_SCOPES.join(" "),
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      },
      LABEL,
    );
    return parseTokenResponse(json, refreshToken, LABEL);
  },

  async getAccount(accessToken): Promise<Account> {
    const me = await fetchJson<{ displayName?: string; mail?: string | null; userPrincipalName?: string }>(
      `${urls().graph}/me?${qs({ $select: "displayName,mail,userPrincipalName" })}`,
      accessToken,
      LABEL,
    );
    const email = me.mail || me.userPrincipalName || "";
    return { email, name: me.displayName || email };
  },

  async listFiles(accessToken, options): Promise<ListResult> {
    const { graph } = urls();
    const top = Math.min(Math.max(options.pageSize ?? 50, 1), 200);
    let url: string;
    if (options.pageToken) {
      if (!isSafeGraphNextLink(options.pageToken, graph)) {
        throw new IntegrationError("provider", "Invalid page token.", 400);
      }
      url = options.pageToken;
    } else if (options.query?.trim()) {
      const term = encodeURIComponent(escapeGraphSearchTerm(options.query.trim()));
      url = `${graph}/me/drive/root/search(q='${term}')?${qs({ $top: top, $select: ITEM_SELECT })}`;
    } else if (options.folderId?.trim()) {
      url = `${graph}/me/drive/items/${encodeURIComponent(options.folderId.trim())}/children?${qs({
        $top: top,
        $orderby: "name",
        $select: ITEM_SELECT,
      })}`;
    } else {
      url = `${graph}/me/drive/root/children?${qs({ $top: top, $orderby: "name", $select: ITEM_SELECT })}`;
    }
    const json = await fetchJson<{ value?: GraphDriveItem[]; "@odata.nextLink"?: string }>(url, accessToken, LABEL);
    return {
      files: (json.value ?? []).map(normalizeMicrosoftItem),
      nextPageToken: json["@odata.nextLink"] ?? null,
    };
  },

  async getFile(accessToken, id): Promise<RemoteFile> {
    const json = await fetchJson<GraphDriveItem>(
      `${urls().graph}/me/drive/items/${encodeURIComponent(id)}?${qs({ $select: ITEM_SELECT })}`,
      accessToken,
      LABEL,
    );
    return normalizeMicrosoftItem(json);
  },

  async downloadFile(accessToken, id, { maxBytes }): Promise<DownloadedFile> {
    const meta = await this.getFile(accessToken, id);
    if (meta.isFolder) {
      throw new IntegrationError("unsupported", "Folders cannot be imported. Open the folder and select files inside it.", 400, meta.name);
    }
    if (meta.mimeType.startsWith("application/vnd.microsoft.package.")) {
      throw new IntegrationError("unsupported", "OneNote notebooks and other packages cannot be imported.", 400, meta.name);
    }
    if (meta.size !== null && meta.size > maxBytes) {
      throw new IntegrationError(
        "too_large",
        `The file is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB upload limit.`,
        413,
        meta.name,
      );
    }

    // /content answers 302 with a short-lived, pre-authenticated download URL. Follow it
    // manually so the bearer token is never sent to the storage host.
    const contentUrl = `${urls().graph}/me/drive/items/${encodeURIComponent(id)}/content`;
    let res: Response;
    try {
      res = await fetch(contentUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new IntegrationError("network", friendlyMessage("network", LABEL), 502, meta.name);
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel().catch(() => undefined);
      if (!location) throw new IntegrationError("provider", friendlyMessage("provider", LABEL), 502, meta.name);
      try {
        res = await fetch(location, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
      } catch {
        throw new IntegrationError("network", friendlyMessage("network", LABEL), 502, meta.name);
      }
    }
    if (!res.ok) {
      console.error(`[integrations] ${LABEL}: content download responded ${res.status}`);
      throw errorFromStatus(res.status, LABEL, meta.name);
    }
    const buffer = await readBodyWithLimit(res, maxBytes, meta.name);
    return {
      buffer,
      fileName: meta.name,
      mimeType: meta.mimeType,
      externalId: meta.id,
      externalUrl: meta.webUrl,
      modifiedTime: meta.modifiedTime ? new Date(meta.modifiedTime) : null,
    };
  },
  // Microsoft identity platform has no token revocation endpoint for confidential clients;
  // deleting the stored tokens is the disconnect. Users can also revoke the app at
  // https://myaccount.microsoft.com/ (or an admin in Entra under Enterprise applications).
};
