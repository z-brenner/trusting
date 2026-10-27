"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  destroySession,
  destroyAllSessionsForUser,
  isSetupComplete,
} from "@/lib/auth";
import { loginSchema, setupSchema, fieldErrors, passwordSchema } from "@/lib/validation";
import { LIMITS, rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { audit } from "@/lib/audit";
import { getDraft, TRUST_CENTER_ID } from "@/lib/trust-center";

export type FormState =
  | { errors?: Record<string, string>; message?: string; ok?: boolean; values?: Record<string, string> }
  | undefined;

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await isSetupComplete()) redirect("/login");
  const ip = (await getClientIp()) ?? "unknown";
  const rl = rateLimit(`setup:${ip}`, LIMITS.setup.limit, LIMITS.setup.windowMs);
  if (!rl.ok) return { message: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.` };

  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    companyName: formData.get("companyName"),
  });
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
  };
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const passwordHash = await hashPassword(parsed.data.password);
  // Guard against a race where two setup submissions arrive simultaneously.
  const user = await prisma.$transaction(async (tx) => {
    if ((await tx.adminUser.count()) > 0) return null;
    return tx.adminUser.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash },
    });
  });
  if (!user) redirect("/login");

  await getDraft();
  await prisma.trustCenter.update({
    where: { id: TRUST_CENTER_ID },
    data: { companyName: parsed.data.companyName, title: `${parsed.data.companyName} Trust Center` },
  });

  const ua = (await headers()).get("user-agent");
  const { token, expiresAt } = await createSession(user.id, { ipAddress: ip, userAgent: ua });
  await setSessionCookie(token, expiresAt);
  await audit({ action: "auth.setup", actorId: user.id, actorLabel: user.email, ipAddress: ip });
  redirect("/admin/edit/1?welcome=1");
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = (await getClientIp()) ?? "unknown";
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { message: "Enter your email address and password.", values };

  const key = `login:${ip}:${parsed.data.email}`;
  const rl = rateLimit(key, LIMITS.login.limit, LIMITS.login.windowMs);
  const rlIp = rateLimit(`login-ip:${ip}`, LIMITS.login.limit * 3, LIMITS.login.windowMs);
  if (!rl.ok || !rlIp.ok) {
    return { message: "Too many sign-in attempts. Please wait a few minutes and try again.", values };
  }

  const user = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  // Always run a verification so timing does not reveal whether the account exists.
  const ok = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await verifyPassword(parsed.data.password, DUMMY_HASH);
  if (!user || !ok) {
    await audit({ action: "auth.login_failed", actorLabel: parsed.data.email, ipAddress: ip });
    return { message: "Incorrect email address or password.", values };
  }

  resetRateLimit(key);
  const ua = (await headers()).get("user-agent");
  const { token, expiresAt } = await createSession(user.id, { ipAddress: ip, userAgent: ua });
  await setSessionCookie(token, expiresAt);
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ action: "auth.login", actorId: user.id, actorLabel: user.email, ipAddress: ip });

  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await destroySession(session.id);
    await audit({ action: "auth.logout", actorId: session.userId, actorLabel: session.user.email });
  }
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const ip = (await getClientIp()) ?? "unknown";
  const rl = rateLimit(`pw:${session.userId}`, LIMITS.passwordChange.limit, LIMITS.passwordChange.windowMs);
  if (!rl.ok) return { message: "Too many attempts. Please wait a few minutes." };

  const current = String(formData.get("currentPassword") ?? "");
  const nextPw = passwordSchema.safeParse(formData.get("newPassword"));
  if (!nextPw.success) return { errors: { newPassword: nextPw.error.issues[0]?.message ?? "Invalid password" } };
  if (nextPw.data !== String(formData.get("confirmPassword") ?? "")) {
    return { errors: { confirmPassword: "Passwords do not match" } };
  }
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await verifyPassword(current, user.passwordHash))) {
    return { errors: { currentPassword: "Current password is incorrect" } };
  }
  await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(nextPw.data) } });
  await destroyAllSessionsForUser(user.id, session.id);
  await audit({ action: "auth.password_changed", actorId: user.id, actorLabel: user.email, ipAddress: ip });
  return { ok: true, message: "Password updated. Other sessions have been signed out." };
}

// A structurally valid scrypt hash used to equalise timing for unknown accounts.
const DUMMY_HASH =
  "scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
