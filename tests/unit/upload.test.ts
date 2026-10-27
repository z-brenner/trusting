import { afterAll, describe, expect, it } from "vitest";
import { rmSync } from "node:fs";
import { validateAndStoreFile, sanitizeFileName } from "@/lib/documents/upload";
import { storage } from "@/lib/storage";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

afterAll(() => rmSync("./storage-test", { recursive: true, force: true }));

describe("upload validation", () => {
  it("stores a PDF under a random key and hashes it", async () => {
    const stored = await validateAndStoreFile({ buffer: PDF, fileName: "../../etc/Policy v2.pdf", kind: "document" });
    expect(stored.mimeType).toBe("application/pdf");
    expect(stored.fileName).toBe("Policy v2.pdf");
    expect(stored.storageKey).toMatch(/^documents\/[0-9a-f]{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(stored.sha256).toHaveLength(64);
    expect(await storage().exists(stored.storageKey)).toBe(true);
  });
  it("detects type by content, not by extension", async () => {
    await expect(validateAndStoreFile({ buffer: Buffer.from("MZ\x90\x00 fake exe"), fileName: "report.pdf", kind: "document" })).rejects.toThrow(/not supported|does not match/);
    await expect(validateAndStoreFile({ buffer: PNG, fileName: "logo.png", kind: "logo" })).resolves.toMatchObject({ mimeType: "image/png" });
    await expect(validateAndStoreFile({ buffer: PDF, fileName: "x.pdf", kind: "logo" })).rejects.toThrow(/not supported/);
  });
  it("rejects scripts in SVG logos and empty files", async () => {
    await expect(validateAndStoreFile({ buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), fileName: "l.svg", kind: "logo" })).rejects.toThrow(/scripts/);
    await expect(validateAndStoreFile({ buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'), fileName: "l.svg", kind: "logo" })).resolves.toMatchObject({ mimeType: "image/svg+xml" });
    await expect(validateAndStoreFile({ buffer: Buffer.alloc(0), fileName: "e.pdf", kind: "document" })).rejects.toThrow(/empty/);
  });
  it("sanitizes file names", () => {
    expect(sanitizeFileName("..\\..\\win\\evil\u0000.pdf")).toBe("evil.pdf");
    expect(sanitizeFileName("")).toBe("document");
  });
});
