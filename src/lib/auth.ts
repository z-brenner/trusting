import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { randomToken, sha256 } from "./crypto";
import { isProduction } from "./env";

export const SESSION_COOKIE = "tc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24; // sliding renewal once a day

export type AdminSession = {
  id: string;
  userId: string;
  user: { id: string; email: string; name: string };
  expiresAt: Date;
};

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
    expires,
  };
}

export async function createSession(
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}

/** Resolve the current admin session from the cookie (cached per request). */
export const getSession = cache(async (): Promise<AdminSession | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionByToken(token);
});

export async function getSessionByToken(token: string): Promise<AdminSession | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Sliding renewal: extend once per day of activity.
  const remaining = session.expiresAt.getTime() - Date.now();
  if (remaining < (SESSION_TTL_SECONDS - SESSION_RENEW_AFTER_SECONDS) * 1000) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await prisma.session.update({ where: { id: session.id }, data: { expiresAt } }).catch(() => undefined);
    session.expiresAt = expiresAt;
  }
  return { id: session.id, userId: session.userId, user: session.user, expiresAt: session.expiresAt };
}

/** For pages/actions: redirect to login when not authenticated. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) {
    const count = await prisma.adminUser.count();
    redirect(count === 0 ? "/setup" : "/login");
  }
  return session;
}

/** For route handlers: returns null instead of redirecting. */
export async function requireAdminApi(): Promise<AdminSession | null> {
  return getSession();
}

export async function destroySession(sessionId: string) {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
}

export async function destroyAllSessionsForUser(userId: string, exceptSessionId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

export async function isSetupComplete(): Promise<boolean> {
  return (await prisma.adminUser.count()) > 0;
}
