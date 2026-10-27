import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { verifyDownloadToken, effectiveVisibility, getActiveGrant } from "@/lib/documents/access";
import { getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request";

/**
 * Streams a document after authorization.
 * Requires a short-lived signed token (?t=) minted by the server for an
 * authorized context: public document, approved access grant, or admin.
 * Storage keys and bucket URLs are never exposed.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = clientIpFromRequest(req) ?? "unknown";
  const rl = rateLimit(`download:${ip}`, LIMITS.download.limit, LIMITS.download.windowMs);
  if (!rl.ok) return new Response("Too many requests", { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } });

  const token = req.nextUrl.searchParams.get("t") ?? "";
  const payload = verifyDownloadToken(token, id);
  if (!payload) return new Response("This download link is invalid or has expired.", { status: 403 });

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });

  // Re-check authorization at download time; tokens only prove intent, not current permission.
  let actorLabel: string | null = null;
  if (payload.via === "admin") {
    const session = await getSession();
    if (!session) return new Response("Sign in required", { status: 401 });
    actorLabel = session.user.email;
  } else if (payload.via === "public") {
    const vis = await effectiveVisibility(id);
    if (vis !== "PUBLIC") return new Response("This document is not publicly available.", { status: 403 });
    if (!doc.allowDownload && req.nextUrl.searchParams.get("inline") !== "1") {
      return new Response("Downloads are disabled for this document.", { status: 403 });
    }
  } else if (payload.via === "grant") {
    const grantToken = req.cookies.get("tc_grant")?.value ?? "";
    const grant = await getActiveGrant(grantToken);
    if (!grant || grant.id !== payload.g || !grant.documents.some((d) => d.documentId === id)) {
      return new Response("Your access to this document has expired or was revoked.", { status: 403 });
    }
    const vis = await effectiveVisibility(id);
    if (vis === "PRIVATE") return new Response("This document is no longer available.", { status: 403 });
    actorLabel = grant.requesterEmail;
  } else {
    return new Response("Forbidden", { status: 403 });
  }

  const obj = await storage().get(doc.storageKey);
  if (!obj) return new Response("File missing from storage", { status: 404 });

  const inline = req.nextUrl.searchParams.get("inline") === "1" && doc.mimeType === "application/pdf";
  const safeName = doc.fileName.replace(/[^\w.\-() ]+/g, "_").slice(0, 150) || "document";

  await audit({
    action: "document.downloaded",
    actorLabel,
    targetType: "document",
    targetId: doc.id,
    metadata: { via: payload.via, title: doc.title },
    ipAddress: ip,
  });

  return new Response(Readable.toWeb(obj.stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(obj.size ?? doc.sizeBytes),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
