"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, destroyAllSessionsForUser } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { emailSchema, passwordSchema, fieldErrors } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import type { FormState } from "@/lib/actions/auth";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: emailSchema,
});

const newAdminSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  email: emailSchema,
  password: passwordSchema,
});

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  try {
    await prisma.adminUser.update({
      where: { id: session.userId },
      data: { name: parsed.data.name, email: parsed.data.email },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { errors: { email: "Another administrator already uses this email address" }, values };
    throw err;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Profile updated." };
}

export async function addAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const values = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  const parsed = newAdminSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  let created: { id: string; email: string };
  try {
    created = await prisma.adminUser.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash: await hashPassword(parsed.data.password) },
      select: { id: true, email: true },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { errors: { email: "An administrator with this email address already exists" }, values };
    throw err;
  }
  await audit({
    action: "admin.created",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "admin_user",
    targetId: created.id,
    metadata: { email: created.email },
    ipAddress: await getClientIp(),
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: `${parsed.data.name} can now sign in with the temporary password. Ask them to change it after signing in.` };
}

export async function removeAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdmin();
  const id = z.string().min(1).max(64).safeParse(formData.get("userId"));
  if (!id.success) return { message: "Unknown administrator." };
  if (id.data === session.userId) return { message: "You cannot remove your own account. Ask another administrator to do it." };

  const result = await prisma.$transaction(async (tx) => {
    const target = await tx.adminUser.findUnique({ where: { id: id.data }, select: { id: true, email: true, name: true } });
    if (!target) return { error: "This administrator no longer exists." };
    const count = await tx.adminUser.count();
    if (count <= 1) return { error: "At least one administrator must remain." };
    // Sessions cascade on delete, so the removed administrator is signed out everywhere.
    await tx.adminUser.delete({ where: { id: target.id } });
    return { target };
  });
  if ("error" in result) return { message: result.error };

  await audit({
    action: "admin.deleted",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "admin_user",
    targetId: result.target.id,
    metadata: { email: result.target.email },
    ipAddress: await getClientIp(),
  });
  revalidatePath("/admin/settings");
  return { ok: true, message: `${result.target.name} was removed and signed out.` };
}

export async function signOutOtherSessionsAction(): Promise<FormState> {
  const session = await requireAdmin();
  const before = await prisma.session.count({ where: { userId: session.userId, id: { not: session.id } } });
  await destroyAllSessionsForUser(session.userId, session.id);
  revalidatePath("/admin/settings");
  return {
    ok: true,
    message: before === 0 ? "No other devices were signed in." : `Signed out of ${before} other ${before === 1 ? "device" : "devices"}.`,
  };
}
