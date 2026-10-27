import { requireAdminApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertSameOrigin, clientIpFromRequest, CsrfError } from "@/lib/request";
import { storage } from "@/lib/storage";
import { UploadError, validateAndStoreFile } from "@/lib/documents/upload";
import { getDraft, TRUST_CENTER_ID } from "@/lib/trust-center";

/**
 * Organisation logo upload. Multipart POST with a single "file" field.
 * The logo is validated by magic bytes (PNG/JPEG/WebP/SVG, 2 MB max), stored
 * under a random key and served publicly by GET /api/logo.
 */
export async function POST(req: Request) {
  const session = await requireAdminApi();
  if (!session) return json({ ok: false, message: "Sign in to continue." }, 401);
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof CsrfError) return json({ ok: false, message: "Cross-site request rejected." }, 403);
    throw err;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, message: "Expected a multipart form." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ ok: false, message: "Choose an image file." }, 400);

  try {
    const stored = await validateAndStoreFile({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      kind: "logo",
    });
    await getDraft();
    const previous = await prisma.trustCenter.findUnique({ where: { id: TRUST_CENTER_ID }, select: { logoKey: true } });
    await prisma.trustCenter.update({
      where: { id: TRUST_CENTER_ID },
      data: { logoKey: stored.storageKey, logoMime: stored.mimeType },
    });
    if (previous?.logoKey && previous.logoKey !== stored.storageKey) {
      await storage().delete(previous.logoKey).catch(() => undefined);
    }
    await audit({
      action: "trustcenter.logo_updated",
      actorId: session.userId,
      actorLabel: session.user.email,
      targetType: "trustcenter",
      targetId: TRUST_CENTER_ID,
      metadata: { mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, fileName: stored.fileName },
      ipAddress: clientIpFromRequest(req),
    });
    return json({ ok: true, url: `/api/logo?v=${Date.now()}`, mimeType: stored.mimeType });
  } catch (err) {
    if (err instanceof UploadError) return json({ ok: false, message: err.message }, err.status);
    console.error(err);
    return json({ ok: false, message: "The upload failed. Please try again." }, 500);
  }
}

/** Remove the logo (and its stored object). */
export async function DELETE(req: Request) {
  const session = await requireAdminApi();
  if (!session) return json({ ok: false, message: "Sign in to continue." }, 401);
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof CsrfError) return json({ ok: false, message: "Cross-site request rejected." }, 403);
    throw err;
  }
  const tc = await prisma.trustCenter.findUnique({ where: { id: TRUST_CENTER_ID }, select: { logoKey: true } });
  if (tc?.logoKey) {
    await prisma.trustCenter.update({ where: { id: TRUST_CENTER_ID }, data: { logoKey: null, logoMime: null } });
    await storage().delete(tc.logoKey).catch(() => undefined);
    await audit({
      action: "trustcenter.logo_removed",
      actorId: session.userId,
      actorLabel: session.user.email,
      targetType: "trustcenter",
      targetId: TRUST_CENTER_ID,
      ipAddress: clientIpFromRequest(req),
    });
  }
  return json({ ok: true });
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
