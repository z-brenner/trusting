import type { DocumentVisibility } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { signPayload, verifyPayload, sha256 } from "../crypto";
import { getPublished } from "../snapshot";

/**
 * Document access rules.
 *
 * A visitor may open a document only when BOTH the published snapshot and the
 * current draft allow it. Tightening visibility in the draft therefore takes
 * effect immediately, while loosening it requires publishing.
 *
 *  - PUBLIC:  anyone with the public page may download.
 *  - REQUEST: requires an approved, unexpired access grant that lists the document.
 *  - PRIVATE: administrators only.
 */
export type EffectiveVisibility = DocumentVisibility;

const RANK: Record<DocumentVisibility, number> = { PUBLIC: 0, REQUEST: 1, PRIVATE: 2 };

export function mostRestrictive(a: DocumentVisibility, b: DocumentVisibility): DocumentVisibility {
  return RANK[a] >= RANK[b] ? a : b;
}

export async function effectiveVisibility(documentId: string): Promise<EffectiveVisibility | null> {
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { visibility: true } });
  if (!doc) return null;
  const published = await getPublished();
  const snap = published?.snapshot.documents.find((d) => d.id === documentId);
  if (!snap) return "PRIVATE";
  return mostRestrictive(doc.visibility, snap.visibility);
}

// ---------- Time-limited download links ----------

const DOWNLOAD_TTL_SECONDS = 10 * 60;

export type DownloadTokenPayload = { d: string; via: "public" | "grant" | "admin"; g?: string };

/** Mint a short-lived URL for a document. The caller must already have authorized access. */
export function signDownloadUrl(documentId: string, via: DownloadTokenPayload["via"], grantId?: string, inline = false) {
  const token = signPayload({ d: documentId, via, ...(grantId ? { g: grantId } : {}) }, DOWNLOAD_TTL_SECONDS);
  return `/api/files/${encodeURIComponent(documentId)}?t=${encodeURIComponent(token)}${inline ? "&inline=1" : ""}`;
}

export function verifyDownloadToken(token: string, documentId: string): DownloadTokenPayload | null {
  const payload = verifyPayload<DownloadTokenPayload & Record<string, string | number | boolean>>(token);
  if (!payload || payload.d !== documentId) return null;
  return payload;
}

// ---------- Access grants ----------

export const GRANT_DEFAULT_DAYS = 14;

export function hashGrantToken(token: string) {
  return sha256(token);
}

/** Resolve a grant token to an approved, unexpired request with its documents. */
export async function getActiveGrant(token: string) {
  if (!token || token.length > 200) return null;
  const req = await prisma.accessRequest.findUnique({
    where: { grantTokenHash: hashGrantToken(token) },
    include: { documents: { include: { document: true } } },
  });
  if (!req || req.status !== "APPROVED") return null;
  if (!req.grantExpiresAt || req.grantExpiresAt.getTime() < Date.now()) return null;
  return req;
}

/** Documents a visitor may currently download through a grant. */
export async function grantDocuments(grantToken: string) {
  const grant = await getActiveGrant(grantToken);
  if (!grant) return null;
  const published = await getPublished();
  const docs = grant.documents
    .map((x) => x.document)
    .filter((doc) => {
      if (doc.visibility === "PRIVATE") return false;
      const snap = published?.snapshot.documents.find((d) => d.id === doc.id);
      return Boolean(snap);
    });
  return { grant, documents: docs };
}
