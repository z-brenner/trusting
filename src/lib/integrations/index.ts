import type { Integration } from "@/generated/prisma/client";
import { prisma } from "../db";
import { decryptSecret, encryptSecret } from "../crypto";
import { googleClient } from "./google";
import { microsoftClient } from "./microsoft";
import { IntegrationError, friendlyMessage } from "./oauth";
import type { Account, DownloadedFile, ListOptions, ListResult, ProviderClient, ProviderKey, TokenSet } from "./types";
import { isProviderKey, PROVIDER_KEYS } from "./types";

export { IntegrationError, friendlyMessage } from "./oauth";
export type { ProviderClient, ProviderKey, RemoteFile, ListResult, DownloadedFile } from "./types";
export { PROVIDER_KEYS, isProviderKey } from "./types";

/** Provider registry. Everything else addresses providers by key ("google" | "microsoft"). */
export const providers: Record<ProviderKey, ProviderClient> = {
  google: googleClient,
  microsoft: microsoftClient,
};

export function getProvider(key: string): ProviderClient | null {
  return isProviderKey(key) ? providers[key] : null;
}

/** Refresh when the access token expires within this window. */
const REFRESH_SKEW_MS = 2 * 60 * 1000;

export async function getIntegration(key: ProviderKey): Promise<Integration | null> {
  return prisma.integration.findUnique({ where: { provider: providers[key].dbProvider } });
}

/** Status summary for the admin UI (never includes token material). */
export async function listIntegrationStatus() {
  const rows = await prisma.integration.findMany();
  return PROVIDER_KEYS.map((key) => {
    const p = providers[key];
    const row = rows.find((r) => r.provider === p.dbProvider) ?? null;
    return {
      key,
      label: p.label,
      configured: p.configured(),
      redirectUri: p.redirectUri(),
      docsPath: p.docsPath,
      scopeDescriptions: [...p.scopeDescriptions],
      connection: row
        ? {
            accountEmail: row.accountEmail,
            accountName: row.accountName,
            connectedAt: row.createdAt,
            updatedAt: row.updatedAt,
            scopes: row.scopes,
          }
        : null,
    };
  });
}

/** Persists a token set (encrypted) and, on connect, the account identity. */
export async function saveTokens(
  key: ProviderKey,
  tokens: TokenSet,
  connect?: { account: Account; connectedById: string },
): Promise<Integration> {
  const provider = providers[key];
  const data = {
    accessTokenEnc: encryptSecret(tokens.accessToken),
    refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
    tokenExpiresAt: tokens.expiresAt,
    scopes: tokens.scopes || provider.scopes.join(" "),
  };
  if (connect) {
    return prisma.integration.upsert({
      where: { provider: provider.dbProvider },
      update: {
        ...data,
        accountEmail: connect.account.email,
        accountName: connect.account.name,
        connectedById: connect.connectedById,
        // A reconnect is a new connection: reset the "connected since" timestamp.
        createdAt: new Date(),
      },
      create: {
        provider: provider.dbProvider,
        ...data,
        accountEmail: connect.account.email,
        accountName: connect.account.name,
        connectedById: connect.connectedById,
      },
    });
  }
  return prisma.integration.update({ where: { provider: provider.dbProvider }, data });
}

function decryptOrReconnect(value: string, label: string): string {
  try {
    return decryptSecret(value);
  } catch {
    // ENCRYPTION_KEY changed or the row is corrupt; the only fix is to reconnect.
    throw new IntegrationError("reconnect", friendlyMessage("reconnect", label), 401);
  }
}

/**
 * Returns a usable access token, refreshing (and persisting) it when it is missing an
 * expiry, expires within two minutes, or `force` is set after a 401 from the provider.
 */
export async function getValidAccessToken(key: ProviderKey, options: { force?: boolean } = {}): Promise<string> {
  const provider = providers[key];
  if (!provider.configured()) {
    throw new IntegrationError("not_configured", friendlyMessage("not_configured", provider.label), 404);
  }
  const row = await getIntegration(key);
  if (!row) throw new IntegrationError("not_connected", friendlyMessage("not_connected", provider.label), 409);

  const expiresSoon = !row.tokenExpiresAt || row.tokenExpiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;
  if (!options.force && !expiresSoon) return decryptOrReconnect(row.accessTokenEnc, provider.label);

  if (!row.refreshTokenEnc) {
    throw new IntegrationError("reconnect", friendlyMessage("reconnect", provider.label), 401);
  }
  const refreshToken = decryptOrReconnect(row.refreshTokenEnc, provider.label);
  const tokens = await provider.refresh(refreshToken);
  await saveTokens(key, tokens);
  return tokens.accessToken;
}

/**
 * Runs an API call with a valid token. If the provider still answers 401 (token revoked
 * early, clock skew), refresh once and retry; a second 401 means the user must reconnect.
 */
export async function withAccessToken<T>(key: ProviderKey, fn: (accessToken: string) => Promise<T>): Promise<T> {
  const token = await getValidAccessToken(key);
  try {
    return await fn(token);
  } catch (err) {
    if (err instanceof IntegrationError && err.code === "reconnect" && err.status === 401) {
      const fresh = await getValidAccessToken(key, { force: true });
      return fn(fresh);
    }
    throw err;
  }
}

export async function listFiles(key: ProviderKey, options: ListOptions): Promise<ListResult> {
  const result = await withAccessToken(key, (token) => providers[key].listFiles(token, options));
  // Folders first, then by name; providers differ in what they can sort server-side.
  const files = [...result.files].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
  return { files, nextPageToken: result.nextPageToken };
}

export async function downloadFile(key: ProviderKey, id: string, maxBytes: number): Promise<DownloadedFile> {
  return withAccessToken(key, (token) => providers[key].downloadFile(token, id, { maxBytes }));
}
