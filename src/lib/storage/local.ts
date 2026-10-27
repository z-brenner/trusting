import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { StorageDriver } from "./index";

/** Filesystem driver. Keys are validated to stay inside the root directory. */
export class LocalStorage implements StorageDriver {
  private root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    if (!/^[a-z0-9_\-./]+$/i.test(key) || key.includes("..")) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, body: Buffer | Readable): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    if (Buffer.isBuffer(body)) {
      await writeFile(full, body, { mode: 0o600 });
    } else {
      await pipeline(body, createWriteStream(full, { mode: 0o600 }));
    }
  }

  async get(key: string) {
    const full = this.resolve(key);
    try {
      const s = await stat(full);
      return { stream: createReadStream(full), size: s.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
