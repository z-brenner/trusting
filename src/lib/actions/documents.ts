"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { storage } from "@/lib/storage";
import { documentMetaSchema, fieldErrors } from "@/lib/validation";
import { signDownloadUrl } from "@/lib/documents/access";

export type DocumentActionResult =
  | { ok: true }
  | { ok: false; message?: string; errors?: Record<string, string> };

const idSchema = z.string().min(1).max(64);

function revalidateDocuments() {
  revalidatePath("/admin/documents");
  revalidatePath("/admin/edit/5");
  revalidatePath("/admin");
}

/**
 * Update a document's metadata. Visibility changes are always an explicit choice
 * made here; nothing is published automatically.
 */
export async function updateDocumentAction(id: string, input: unknown): Promise<DocumentActionResult> {
  const session = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, message: "Unknown document." };
  const parsed = documentMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const existing = await prisma.document.findUnique({
    where: { id: parsedId.data },
    select: { id: true, title: true, visibility: true },
  });
  if (!existing) return { ok: false, message: "This document no longer exists." };

  const data = parsed.data;
  await prisma.document.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      visibility: data.visibility,
      allowDownload: data.allowDownload,
      versionLabel: data.versionLabel,
      documentDate: data.documentDate,
    },
  });

  const ip = await getClientIp();
  await audit({
    action: "document.updated",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "document",
    targetId: existing.id,
    metadata: { title: data.title },
    ipAddress: ip,
  });
  if (existing.visibility !== data.visibility) {
    await audit({
      action: "document.visibility_changed",
      actorId: session.userId,
      actorLabel: session.user.email,
      targetType: "document",
      targetId: existing.id,
      metadata: { title: data.title, from: existing.visibility, to: data.visibility },
      ipAddress: ip,
    });
  }
  revalidateDocuments();
  return { ok: true };
}

export async function deleteDocumentAction(id: string): Promise<DocumentActionResult> {
  const session = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, message: "Unknown document." };

  const doc = await prisma.document.findUnique({
    where: { id: parsedId.data },
    select: { id: true, title: true, storageKey: true, source: true },
  });
  if (!doc) return { ok: true };

  await prisma.document.delete({ where: { id: doc.id } });
  try {
    await storage().delete(doc.storageKey);
  } catch (err) {
    // The database row is gone; an orphaned object is preferable to a dangling reference.
    console.error("storage delete failed", err);
  }
  await audit({
    action: "document.deleted",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "document",
    targetId: doc.id,
    metadata: { title: doc.title, source: doc.source },
    ipAddress: await getClientIp(),
  });
  revalidateDocuments();
  return { ok: true };
}

/** Persist a new display order. Unknown ids are ignored. */
export async function reorderDocumentsAction(ids: string[]): Promise<DocumentActionResult> {
  await requireAdmin();
  const parsed = z.array(idSchema).max(500).safeParse(ids);
  if (!parsed.success) return { ok: false, message: "Invalid order." };
  await prisma.$transaction(
    parsed.data.map((id, index) => prisma.document.updateMany({ where: { id }, data: { sortOrder: index } })),
  );
  revalidateDocuments();
  return { ok: true };
}

/**
 * Mint a short-lived admin download link on demand. Links expire after ten
 * minutes, so the UI asks for one at click time instead of embedding them.
 */
export async function getDocumentOpenUrlAction(id: string): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, message: "Unknown document." };
  const doc = await prisma.document.findUnique({ where: { id: parsedId.data }, select: { id: true, mimeType: true } });
  if (!doc) return { ok: false, message: "This document no longer exists." };
  return { ok: true, url: signDownloadUrl(doc.id, "admin", undefined, doc.mimeType === "application/pdf") };
}
