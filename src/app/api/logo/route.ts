import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { TRUST_CENTER_ID } from "@/lib/trust-center";
import { Readable } from "node:stream";

/** Serves the organisation logo. Logos are not sensitive, so this is public. */
export async function GET() {
  const tc = await prisma.trustCenter.findUnique({
    where: { id: TRUST_CENTER_ID },
    select: { logoKey: true, logoMime: true, updatedAt: true },
  });
  if (!tc?.logoKey) return new Response("Not found", { status: 404 });
  const obj = await storage().get(tc.logoKey);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(Readable.toWeb(obj.stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": tc.logoMime ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
