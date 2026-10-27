import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getProvider, IntegrationError, listFiles } from "@/lib/integrations";

export const dynamic = "force-dynamic";

/**
 * Lists or searches files in the connected account.
 * Query: folder (provider item id), q (search term, searches the whole drive), pageToken.
 * Response: { files: RemoteFile[], nextPageToken: string | null }
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: key } = await ctx.params;
  const session = await requireAdminApi();
  if (!session) return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  const provider = getProvider(key);
  if (!provider || !provider.configured()) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const folderId = (sp.get("folder") ?? "").trim().slice(0, 512) || null;
  const query = (sp.get("q") ?? "").trim().slice(0, 200) || null;
  const pageToken = (sp.get("pageToken") ?? "").trim().slice(0, 4096) || null;

  try {
    const result = await listFiles(provider.key, { folderId, query, pageToken, pageSize: 50 });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof IntegrationError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    }
    console.error(`[integrations] ${provider.label}: listing failed`, err);
    return NextResponse.json({ error: "provider", message: `${provider.label} returned an unexpected error.` }, { status: 502 });
  }
}
