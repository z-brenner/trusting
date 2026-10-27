import { Readable } from "node:stream";
import { env } from "../env";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";

/**
 * Object storage abstraction. Keys are opaque, random, server-generated and are
 * never exposed to visitors; every download is streamed through the app after
 * an authorization check, so buckets can (and should) stay fully private.
 */
export interface StorageDriver {
  put(key: string, body: Buffer | Readable, contentType: string, size?: number): Promise<void>;
  get(key: string): Promise<{ stream: Readable; contentType?: string; size?: number } | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  driver = e.STORAGE_DRIVER === "s3" ? new S3Storage() : new LocalStorage(e.LOCAL_STORAGE_PATH);
  return driver;
}

export function newStorageKey(prefix: "documents" | "logos", ext: string) {
  const id = crypto.randomUUID();
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 8);
  return `${prefix}/${id.slice(0, 2)}/${id}${safeExt ? `.${safeExt}` : ""}`;
}
