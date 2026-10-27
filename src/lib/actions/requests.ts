"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getClientIp } from "@/lib/request";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/email";
import { accessApprovedEmail, accessRejectedEmail } from "@/lib/email-templates";
import { GRANT_DEFAULT_DAYS, hashGrantToken } from "@/lib/documents/access";
import { TRUST_CENTER_ID } from "@/lib/trust-center";

/**
 * Result of approve / regenerate. `link` is returned exactly once: only the
 * hash of the token is stored, so the UI must show it immediately or never.
 */
export type RequestActionState =
  | {
      ok?: boolean;
      message?: string;
      errors?: Record<string, string>;
      link?: string;
      emailed?: boolean;
      emailError?: boolean;
      expiresAt?: string;
    }
  | undefined;

const idSchema = z.string().min(1).max(64);
const approveSchema = z.object({
  expiryDays: z.coerce.number().int("Enter a whole number of days").min(1, "At least 1 day").max(90, "At most 90 days"),
  note: z.string().trim().max(2000).optional().default(""),
});
const rejectSchema = z.object({ reason: z.string().trim().max(2000).optional().default("") });

function revalidate(id: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${id}`);
}

async function companyName() {
  const tc = await prisma.trustCenter.findUnique({ where: { id: TRUST_CENTER_ID }, select: { companyName: true } });
  return tc?.companyName ?? "";
}

function grantLink(token: string) {
  return `${env().APP_URL.replace(/\/$/, "")}/access/${token}`;
}

async function loadRequest(id: string) {
  return prisma.accessRequest.findUnique({
    where: { id },
    include: { documents: { include: { document: { select: { id: true, title: true, visibility: true } } } } },
  });
}

/**
 * Issue a fresh grant token for a request, store only its hash, and try to
 * email the link. Shared by approve and "generate a new link".
 */
async function issueGrant(input: {
  requestId: string;
  expiryDays: number;
  note?: string;
  regenerate: boolean;
  actor: { id: string; email: string };
}): Promise<RequestActionState> {
  const req = await loadRequest(input.requestId);
  if (!req) return { message: "This request no longer exists." };
  if (input.regenerate ? req.status !== "APPROVED" : req.status !== "PENDING") {
    return { message: input.regenerate ? "Only approved requests can get a new link." : "This request has already been decided." };
  }

  // PRIVATE documents are never shared through a grant; the download route enforces this too.
  const grantable = req.documents.map((d) => d.document).filter((d) => d.visibility !== "PRIVATE");
  if (grantable.length === 0) {
    return { message: "None of the requested documents can be shared: they are all private. Change their visibility first." };
  }

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + input.expiryDays * 24 * 60 * 60 * 1000);
  await prisma.accessRequest.update({
    where: { id: req.id },
    data: {
      status: "APPROVED",
      grantTokenHash: hashGrantToken(token),
      grantExpiresAt: expiresAt,
      ...(input.regenerate
        ? {}
        : { decidedAt: new Date(), decidedById: input.actor.id, decisionNote: input.note ?? "" }),
    },
  });

  const link = grantLink(token);
  let emailed = false;
  let emailError = false;
  try {
    const mail = accessApprovedEmail({
      requesterName: req.requesterName,
      companyName: await companyName(),
      documentTitles: grantable.map((d) => d.title),
      link,
      expiresAt,
    });
    emailed = await sendMail({ to: req.requesterEmail, ...mail });
  } catch (err) {
    console.error("approval email failed", err);
    emailError = true;
  }

  await audit({
    action: "access_request.approved",
    actorId: input.actor.id,
    actorLabel: input.actor.email,
    targetType: "access_request",
    targetId: req.id,
    metadata: {
      requesterEmail: req.requesterEmail,
      documentIds: grantable.map((d) => d.id),
      expiresAt: expiresAt.toISOString(),
      emailed,
      ...(input.regenerate ? { regenerated: true } : {}),
    },
    ipAddress: await getClientIp(),
  });
  revalidate(req.id);
  return { ok: true, link, emailed, emailError, expiresAt: expiresAt.toISOString() };
}

export async function approveRequestAction(id: string, _prev: RequestActionState, formData: FormData): Promise<RequestActionState> {
  const session = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { message: "Unknown request." };
  const parsed = approveSchema.safeParse({
    expiryDays: formData.get("expiryDays") || GRANT_DEFAULT_DAYS,
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { errors: { expiryDays: parsed.error.issues[0]?.message ?? "Invalid expiry" } };
  return issueGrant({
    requestId: parsedId.data,
    expiryDays: parsed.data.expiryDays,
    note: parsed.data.note,
    regenerate: false,
    actor: { id: session.userId, email: session.user.email },
  });
}

export async function regenerateGrantLinkAction(id: string, _prev: RequestActionState, formData: FormData): Promise<RequestActionState> {
  const session = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { message: "Unknown request." };
  const parsed = approveSchema.pick({ expiryDays: true }).safeParse({
    expiryDays: formData.get("expiryDays") || GRANT_DEFAULT_DAYS,
  });
  if (!parsed.success) return { errors: { expiryDays: parsed.error.issues[0]?.message ?? "Invalid expiry" } };
  return issueGrant({
    requestId: parsedId.data,
    expiryDays: parsed.data.expiryDays,
    regenerate: true,
    actor: { id: session.userId, email: session.user.email },
  });
}

export async function rejectRequestAction(id: string, _prev: RequestActionState, formData: FormData): Promise<RequestActionState> {
  const session = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { message: "Unknown request." };
  const parsed = rejectSchema.safeParse({ reason: formData.get("reason") ?? "" });
  if (!parsed.success) return { errors: { reason: "The reason is too long." } };

  const req = await prisma.accessRequest.findUnique({ where: { id: parsedId.data } });
  if (!req) return { message: "This request no longer exists." };
  if (req.status !== "PENDING") return { message: "This request has already been decided." };

  await prisma.accessRequest.update({
    where: { id: req.id },
    data: {
      status: "REJECTED",
      decisionNote: parsed.data.reason,
      decidedAt: new Date(),
      decidedById: session.userId,
      grantTokenHash: null,
      grantExpiresAt: null,
    },
  });

  let emailed = false;
  let emailError = false;
  try {
    const mail = accessRejectedEmail({
      requesterName: req.requesterName,
      companyName: await companyName(),
      reason: parsed.data.reason,
    });
    emailed = await sendMail({ to: req.requesterEmail, ...mail });
  } catch (err) {
    console.error("rejection email failed", err);
    emailError = true;
  }

  await audit({
    action: "access_request.rejected",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "access_request",
    targetId: req.id,
    metadata: { requesterEmail: req.requesterEmail, reason: parsed.data.reason, emailed },
    ipAddress: await getClientIp(),
  });
  revalidate(req.id);
  return { ok: true, emailed, emailError };
}

export async function revokeRequestAction(id: string): Promise<RequestActionState> {
  const session = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { message: "Unknown request." };
  const req = await prisma.accessRequest.findUnique({ where: { id: parsedId.data } });
  if (!req) return { message: "This request no longer exists." };
  if (req.status !== "APPROVED") return { message: "Only approved requests can be revoked." };

  await prisma.accessRequest.update({
    where: { id: req.id },
    data: {
      status: "REVOKED",
      grantTokenHash: null,
      grantExpiresAt: null,
      decidedAt: new Date(),
      decidedById: session.userId,
    },
  });
  await audit({
    action: "access_request.revoked",
    actorId: session.userId,
    actorLabel: session.user.email,
    targetType: "access_request",
    targetId: req.id,
    metadata: { requesterEmail: req.requesterEmail },
    ipAddress: await getClientIp(),
  });
  revalidate(req.id);
  return { ok: true, message: "Access revoked. The link no longer works." };
}
