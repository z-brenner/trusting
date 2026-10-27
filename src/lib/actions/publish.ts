"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { publish, unpublish } from "@/lib/snapshot";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";

export async function publishAction(): Promise<{ ok: boolean; version?: number; message?: string }> {
  const session = await requireAdmin();
  try {
    const pub = await publish(session.userId);
    await audit({
      action: "trustcenter.published",
      actorId: session.userId,
      actorLabel: session.user.email,
      targetType: "publication",
      targetId: pub.id,
      metadata: { version: pub.version },
      ipAddress: await getClientIp(),
    });
    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true, version: pub.version };
  } catch (err) {
    console.error(err);
    return { ok: false, message: "Publishing failed. Please try again." };
  }
}

export async function unpublishAction(): Promise<{ ok: boolean }> {
  const session = await requireAdmin();
  await unpublish();
  await audit({
    action: "trustcenter.unpublished",
    actorId: session.userId,
    actorLabel: session.user.email,
    ipAddress: await getClientIp(),
  });
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}
