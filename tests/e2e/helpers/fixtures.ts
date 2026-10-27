import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export const ADMIN = { name: "Ada Admin", email: "admin@example.com", password: "correct-horse-battery-staple" };
export const COMPANY = "Acme Analytics";

const dir = path.resolve("tests/e2e/fixtures");

/** A minimal but valid single-page PDF. */
export const MINIMAL_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer << /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
`,
);

/** 1x1 transparent PNG. */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export function fixturePath(name: "policy.pdf" | "logo.png" | "malware.exe" | "renamed.pdf"): string {
  mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  if (name === "policy.pdf") writeFileSync(p, MINIMAL_PDF);
  if (name === "logo.png") writeFileSync(p, TINY_PNG);
  if (name === "malware.exe") writeFileSync(p, Buffer.from("MZ\x90\x00\x03\x00\x00\x00 fake executable"));
  if (name === "renamed.pdf") writeFileSync(p, Buffer.from("MZ\x90\x00\x03\x00\x00\x00 not really a pdf"));
  return p;
}

/** Context options for an anonymous visitor (the project default carries the admin session). */
export const ANON: { storageState: { cookies: never[]; origins: never[] } } = { storageState: { cookies: [], origins: [] } };

/**
 * Resolves once the App Router has hydrated (it mounts the route announcer on
 * the client). Needed before interacting with forms on a cold dev server, where
 * a pre-hydration submit would fall back to a full-page POST.
 */
export async function waitForHydration(page: import("@playwright/test").Page) {
  await page.locator("#__next-route-announcer__").waitFor({ state: "attached", timeout: 60_000 });
}
