"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { getProvider } from "@/lib/integrations";
import { getClientIp } from "@/lib/request";

export type DisconnectResult = { ok: boolean; message?: string };

/**
 * Removes the stored tokens for a provider and, where the provider supports it, revokes
 * them (best effort). Imported documents are kept; they are copies.
 */
export async function disconnectIntegrationAction(providerKey: string): Promise<DisconnectResult> {
  const session = await requireAdmin();
  const provider = getProvider(providerKey);
  if (!provider) return { ok: false, message: "Unknown integration." };

  const row = await prisma.integration.findUnique({ where: { provider: provider.dbProvider } });
  if (!row) {
    revalidatePath("/admin/integrations");
    return { ok: true };
  }

  let revoked = false;
  if (provider.revoke) {
    try {
      const accessToken = decryptSecret(row.accessTokenEnc);
      const refreshToken = row.refreshTokenEnc ? decryptSecret(row.refreshTokenEnc) : null;
      await provider.revoke({ accessToken, refreshToken });
      revoked = true;
    } catch (err) {
      // Revocation is best effort: deleting the tokens is what matters for us.
      console.warn(`[integrations] ${provider.label}: token revocation skipped`, err instanceof Error ? err.message : err);
    }
  }

  await prisma.integration.delete({ where: { id: row.id } });
  await audit({
    action: "integration.disconnected",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "integration",
    targetId: row.id,
    metadata: { provider: provider.key, accountEmail: row.accountEmail, revoked },
    ipAddress: await getClientIp(),
  });
  revalidatePath("/admin/integrations");
  revalidatePath("/admin/documents");
  return { ok: true };
}
