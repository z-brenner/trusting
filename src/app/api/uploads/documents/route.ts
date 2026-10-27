import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminApi } from "@/lib/auth";
import { assertSameOrigin, clientIpFromRequest, CsrfError } from "@/lib/request";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { maxUploadBytes, UploadError, validateAndStoreFile, sanitizeFileName } from "@/lib/documents/upload";
import { audit } from "@/lib/audit";
import { TRUST_CENTER_ID, getDraft } from "@/lib/trust-center";

export const runtime = "nodejs";

const metaSchema = z.object({
  title: z.string().trim().max(200).optional(),
  category: z
    .enum([
      "PRIVACY_POLICY",
      "SECURITY_POLICY",
      "DATA_PROCESSING_AGREEMENT",
      "PENETRATION_TEST",
      "AUDIT_REPORT",
      "COMPLIANCE_CERTIFICATE",
      "INCIDENT_RESPONSE",
      "BUSINESS_CONTINUITY",
      "OTHER",
    ])
    .optional(),
  visibility: z.enum(["PUBLIC", "REQUEST", "PRIVATE"]).optional(),
});

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Multipart document upload for administrators.
 * Field `file` is required; `title`, `category` and `visibility` are optional.
 * New documents default to PRIVATE so nothing becomes visible by accident.
 */
export async function POST(req: NextRequest) {
  const session = await requireAdminApi();
  if (!session) return json({ error: "Sign in required." }, 401);
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof CsrfError) return json({ error: "Cross-site request rejected." }, 403);
    throw err;
  }

  const rl = rateLimit(`upload:${session.userId}`, LIMITS.upload.limit, LIMITS.upload.windowMs);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many uploads. Try again in ${rl.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const limit = maxUploadBytes();
  const limitMb = Math.round(limit / 1024 / 1024);
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  // Multipart framing adds a little overhead; reject clearly oversized bodies before reading them.
  if (Number.isFinite(contentLength) && contentLength > limit + 64 * 1024) {
    return json({ error: `The file is larger than the ${limitMb} MB limit.` }, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Could not read the upload. Please try again." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "No file was received." }, 400);
  if (file.size > limit) return json({ error: `The file is larger than the ${limitMb} MB limit.` }, 413);

  const meta = metaSchema.safeParse({
    title: form.get("title") ?? undefined,
    category: form.get("category") || undefined,
    visibility: form.get("visibility") || undefined,
  });
  if (!meta.success) return json({ error: "Invalid document details." }, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalName = sanitizeFileName(file.name || "document");

  try {
    const stored = await validateAndStoreFile({ buffer, fileName: originalName, kind: "document" });
    await getDraft();
    const defaultTitle = path.basename(originalName, path.extname(originalName)) || originalName;
    const last = await prisma.document.findFirst({
      where: { trustCenterId: TRUST_CENTER_ID },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const document = await prisma.document.create({
      data: {
        trustCenterId: TRUST_CENTER_ID,
        title: meta.data.title || defaultTitle,
        category: meta.data.category ?? "OTHER",
        visibility: meta.data.visibility ?? "PRIVATE",
        documentDate: new Date(),
        storageKey: stored.storageKey,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        source: "UPLOAD",
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    await audit({
      action: "document.uploaded",
      actorId: session.userId,
      actorLabel: session.user.email,
      targetType: "document",
      targetId: document.id,
      metadata: { title: document.title, fileName: document.fileName, sizeBytes: document.sizeBytes, visibility: document.visibility },
      ipAddress: clientIpFromRequest(req),
    });
    // Storage keys and hashes stay server-side.
    const { storageKey: _storageKey, sha256: _sha256, ...safe } = document;
    void _storageKey;
    void _sha256;
    return json({ document: safe }, 201);
  } catch (err) {
    if (err instanceof UploadError) return json({ error: err.message }, err.status);
    console.error("document upload failed", err);
    return json({ error: "The upload failed. Please try again." }, 500);
  }
}
