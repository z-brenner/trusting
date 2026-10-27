import { fileTypeFromBuffer } from "file-type";
import path from "node:path";
import { sha256 } from "../crypto";
import { env } from "../env";
import { newStorageKey, storage } from "../storage";
import { ALLOWED_LOGO_MIME_TYPES, ALLOWED_MIME_TYPES } from "@/data/document-categories";

export class UploadError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const TEXT_TYPES: Record<string, string> = { txt: "text/plain", md: "text/markdown", csv: "text/csv", svg: "image/svg+xml" };

export type StoredFile = {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  fileName: string;
};

export function maxUploadBytes() {
  return env().MAX_UPLOAD_MB * 1024 * 1024;
}

/** Strip path components and control characters from a user-supplied file name. */
export function sanitizeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, "/")).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (base || "document").slice(0, 200);
}

/**
 * Validates content by magic bytes (not by the declared Content-Type), applies
 * the allow-list, hashes it and writes it to private storage under a random key.
 */
export async function validateAndStoreFile(input: {
  buffer: Buffer;
  fileName: string;
  kind: "document" | "logo";
}): Promise<StoredFile> {
  const { buffer, kind } = input;
  const fileName = sanitizeFileName(input.fileName);
  if (buffer.length === 0) throw new UploadError("The file is empty.");
  const limit = kind === "logo" ? 2 * 1024 * 1024 : maxUploadBytes();
  if (buffer.length > limit) {
    throw new UploadError(`The file is larger than the ${Math.round(limit / 1024 / 1024)} MB limit.`, 413);
  }

  const ext = path.extname(fileName).slice(1).toLowerCase();
  const detected = await fileTypeFromBuffer(buffer);
  let mimeType: string | undefined = detected?.mime;

  if (!mimeType) {
    // file-type cannot detect plain-text formats; accept a few by extension after a UTF-8 sanity check.
    const textMime = TEXT_TYPES[ext];
    if (!textMime) throw new UploadError("This file type is not supported.");
    if (!isProbablyText(buffer)) throw new UploadError("The file content does not match its extension.");
    if (textMime === "image/svg+xml") assertSafeSvg(buffer.toString("utf8"));
    mimeType = textMime;
  }

  // Office formats are zip containers; trust the extension to pick the specific type.
  if (mimeType === "application/zip" && ["docx", "xlsx", "pptx", "odt", "ods"].includes(ext)) {
    mimeType = Object.entries(ALLOWED_MIME_TYPES).find(([, exts]) => exts.includes(ext))?.[0] ?? mimeType;
  }
  if (detected?.mime === "application/x-cfb" && ["doc", "xls", "ppt"].includes(ext)) {
    mimeType = Object.entries(ALLOWED_MIME_TYPES).find(([, exts]) => exts.includes(ext))?.[0] ?? mimeType;
  }

  const allowed = kind === "logo" ? ALLOWED_LOGO_MIME_TYPES : Object.keys(ALLOWED_MIME_TYPES);
  if (!allowed.includes(mimeType)) throw new UploadError("This file type is not supported.");

  const storageKey = newStorageKey(kind === "logo" ? "logos" : "documents", ext);
  await storage().put(storageKey, buffer, mimeType, buffer.length);
  return { storageKey, mimeType, sizeBytes: buffer.length, sha256: sha256(buffer), fileName };
}

function isProbablyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 8192);
  for (const byte of sample) {
    if (byte === 0) return false;
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample);
    return true;
  } catch {
    return false;
  }
}

function assertSafeSvg(svg: string) {
  if (/<script|on[a-z]+\s*=|javascript:|<foreignObject|<iframe|<embed|<object/i.test(svg)) {
    throw new UploadError("SVG files with scripts or event handlers are not allowed.");
  }
}
