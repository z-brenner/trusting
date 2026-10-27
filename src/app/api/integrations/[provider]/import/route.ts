import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  maxUploadBytes,
  UploadError,
  validateAndStoreFile,
} from "@/lib/documents/upload";
import { storage } from "@/lib/storage";
import {
  downloadFile,
  getProvider,
  IntegrationError,
} from "@/lib/integrations";
import { titleFromFileName } from "@/lib/integrations/oauth";
import {
  assertSameOrigin,
  clientIpFromRequest,
  CsrfError,
} from "@/lib/request";
import { getDraft, TRUST_CENTER_ID } from "@/lib/trust-center";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  fileIds: z.array(z.string().trim().min(1).max(512)).min(1).max(20),
});

export type ImportResponse = {
  imported: { id: string; title: string; fileName: string }[];
  errors: { fileId: string; name: string | null; error: string }[];
};

/**
 * Copies the selected files into private document storage. Every imported document is
 * PRIVATE until an administrator changes it. Per-file failures are reported, not fatal.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider: key } = await ctx.params;
  const session = await requireAdminApi();
  if (!session)
    return NextResponse.json(
      { error: "unauthorized", message: "Sign in required." },
      { status: 401 },
    );
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof CsrfError)
      return NextResponse.json(
        { error: "forbidden", message: err.message },
        { status: 403 },
      );
    throw err;
  }
  const provider = getProvider(key);
  if (!provider || !provider.configured())
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid", message: "Select between 1 and 20 files." },
      { status: 400 },
    );
  }
  const fileIds = [...new Set(parsed.data.fileIds)];
  const limit = maxUploadBytes();
  const ip = clientIpFromRequest(req);
  await getDraft();

  const result: ImportResponse = { imported: [], errors: [] };
  for (const fileId of fileIds) {
    let name: string | null = null;
    try {
      const existing = await prisma.document.findFirst({
        where: { source: provider.documentSource, externalId: fileId },
        select: { title: true },
      });
      if (existing) {
        throw new IntegrationError(
          "already_imported",
          `Already imported as "${existing.title}". Delete that document first to import it again.`,
          409,
        );
      }
      const file = await downloadFile(provider.key, fileId, limit);
      name = file.fileName;
      const stored = await validateAndStoreFile({
        buffer: file.buffer,
        fileName: file.fileName,
        kind: "document",
      });
      const doc = await prisma.document
        .create({
          data: {
            trustCenterId: TRUST_CENTER_ID,
            title: titleFromFileName(stored.fileName),
            // Imports are never exposed until an administrator explicitly changes visibility.
            visibility: "PRIVATE",
            source: provider.documentSource,
            externalId: file.externalId,
            externalUrl: file.externalUrl,
            documentDate: file.modifiedTime,
            storageKey: stored.storageKey,
            fileName: stored.fileName,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            sha256: stored.sha256,
          },
        })
        .catch(async (err: unknown) => {
          // Do not leave an orphaned object behind when the row cannot be written.
          await storage()
            .delete(stored.storageKey)
            .catch(() => undefined);
          throw err;
        });
      await audit({
        action: "document.imported",
        actorId: session.userId,
        actorLabel: session.user.email,
        targetType: "document",
        targetId: doc.id,
        metadata: {
          provider: provider.key,
          externalId: file.externalId,
          title: doc.title,
          sizeBytes: doc.sizeBytes,
          mimeType: doc.mimeType,
        },
        ipAddress: ip,
      });
      result.imported.push({
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
      });
    } catch (err) {
      if (err instanceof IntegrationError) {
        result.errors.push({
          fileId,
          name: err.fileName ?? name,
          error: err.message,
        });
        // A dead connection will fail every remaining file the same way; stop early.
        if (
          err.code === "reconnect" ||
          err.code === "not_connected" ||
          err.code === "not_configured"
        ) {
          for (const rest of fileIds.slice(fileIds.indexOf(fileId) + 1)) {
            result.errors.push({
              fileId: rest,
              name: null,
              error: err.message,
            });
          }
          return NextResponse.json(result, { status: 200 });
        }
      } else if (err instanceof UploadError) {
        result.errors.push({ fileId, name, error: err.message });
      } else {
        console.error(
          `[integrations] ${provider.label}: import of ${fileId} failed`,
          err,
        );
        result.errors.push({
          fileId,
          name,
          error: "The file could not be imported. Please try again.",
        });
      }
    }
  }
  return NextResponse.json(result, { status: 200 });
}
