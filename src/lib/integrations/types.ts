import type { DocumentSource, IntegrationProvider } from "@/generated/prisma/enums";

export type ProviderKey = "google" | "microsoft";

export const PROVIDER_KEYS: readonly ProviderKey[] = ["google", "microsoft"] as const;

export function isProviderKey(value: string): value is ProviderKey {
  return (PROVIDER_KEYS as readonly string[]).includes(value);
}

/** Tokens as returned by a provider's token endpoint (plaintext, never persisted as-is). */
export type TokenSet = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string;
};

export type Account = { email: string; name: string };

/** Provider-neutral view of a file or folder, as returned to the picker. */
export type RemoteFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  isFolder: boolean;
  webUrl: string | null;
};

export type ListOptions = {
  folderId?: string | null;
  query?: string | null;
  pageToken?: string | null;
  pageSize?: number;
};

export type ListResult = { files: RemoteFile[]; nextPageToken: string | null };

export type DownloadedFile = {
  buffer: Buffer;
  /** File name including extension (Google native documents become "<name>.pdf"). */
  fileName: string;
  mimeType: string;
  externalId: string;
  externalUrl: string | null;
  modifiedTime: Date | null;
};

/**
 * A stateless provider client. Methods that talk to the provider's API take the
 * access token explicitly; token storage and refresh live in `index.ts`.
 */
export interface ProviderClient {
  key: ProviderKey;
  label: string;
  dbProvider: IntegrationProvider;
  documentSource: DocumentSource;
  scopes: readonly string[];
  /** Plain-language description of what each granted scope allows. */
  scopeDescriptions: readonly string[];
  docsPath: string;
  configured(): boolean;
  redirectUri(): string;
  authUrl(input: { state: string; codeChallenge: string }): string;
  exchangeCode(input: { code: string; codeVerifier: string }): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  getAccount(accessToken: string): Promise<Account>;
  listFiles(accessToken: string, options: ListOptions): Promise<ListResult>;
  getFile(accessToken: string, id: string): Promise<RemoteFile>;
  downloadFile(accessToken: string, id: string, options: { maxBytes: number }): Promise<DownloadedFile>;
  /** Best-effort token revocation; absent when the provider has no revoke endpoint. */
  revoke?(tokens: { accessToken: string; refreshToken: string | null }): Promise<void>;
}
