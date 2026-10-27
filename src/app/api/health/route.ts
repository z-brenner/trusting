import { prisma } from "@/lib/db";
import { version } from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for container orchestration and reverse proxies.
 * Public by design: it only reveals whether the database answers and which
 * application version is running. Never add configuration or secrets here.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, version }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
