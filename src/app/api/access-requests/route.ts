import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { escapeHtml, sendMail } from "@/lib/email";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, clientIpFromRequest, CsrfError } from "@/lib/request";
import { getPublished } from "@/lib/snapshot";
import { accessRequestSchema, fieldErrors } from "@/lib/validation";

/**
 * Public submission of a document access request.
 * Guarded by same-origin, a per-IP rate limit and a honeypot field. Only documents
 * that are published with "Request access" visibility can be requested.
 */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
  } catch (err) {
    if (err instanceof CsrfError) return Response.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
    throw err;
  }

  const ip = clientIpFromRequest(req) ?? "unknown";
  const rl = rateLimit(`access-request:${ip}`, LIMITS.accessRequest.limit, LIMITS.accessRequest.windowMs);
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });

  // Honeypot: bots fill every field. Pretend it worked and do nothing.
  const honeypot = (body as Record<string, unknown>).website;
  if (typeof honeypot === "string" && honeypot.length > 0) return Response.json({ ok: true });

  const parsed = accessRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 400 });
  const input = parsed.data;

  const published = await getPublished();
  if (!published) return Response.json({ ok: false, error: "This Trust Center is not published." }, { status: 404 });

  const requestable = new Map(published.snapshot.documents.filter((d) => d.visibility === "REQUEST").map((d) => [d.id, d]));
  const documentIds = Array.from(new Set(input.documentIds)).filter((id) => requestable.has(id));
  if (documentIds.length === 0) {
    return Response.json({ ok: false, errors: { documentIds: "Select at least one document that is available on request." } }, { status: 400 });
  }

  const request = await prisma.accessRequest.create({
    data: {
      requesterName: input.requesterName,
      requesterEmail: input.requesterEmail,
      company: input.company,
      message: input.message,
      ipAddress: ip === "unknown" ? null : ip,
      documents: { create: documentIds.map((documentId) => ({ documentId })) },
    },
  });

  await audit({
    action: "access_request.created",
    actorLabel: input.requesterEmail,
    targetType: "access_request",
    targetId: request.id,
    metadata: { documentIds, company: input.company },
    ipAddress: ip === "unknown" ? null : ip,
  });

  const titles = documentIds.map((id) => requestable.get(id)!.title);
  notifyAdministrators({ ...input, titles, requestId: request.id }).catch((err) => console.error("access request notification failed", err));

  return Response.json({ ok: true });
}

async function notifyAdministrators(input: {
  requesterName: string;
  requesterEmail: string;
  company: string;
  message: string;
  titles: string[];
  requestId: string;
}) {
  const admins = await prisma.adminUser.findMany({ select: { email: true } });
  if (admins.length === 0) return;
  const link = `${env().APP_URL.replace(/\/$/, "")}/admin/requests`;
  const subject = "New document access request";
  const text = [
    `${input.requesterName} <${input.requesterEmail}>${input.company ? ` (${input.company})` : ""} requested access to:`,
    ...input.titles.map((t) => `  - ${t}`),
    "",
    input.message ? `Message:\n${input.message}\n` : "",
    `Review the request: ${link}`,
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(input.requesterName)}</strong> &lt;${escapeHtml(input.requesterEmail)}&gt;${
      input.company ? ` (${escapeHtml(input.company)})` : ""
    } requested access to:</p>
    <ul>${input.titles.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
    ${input.message ? `<p><strong>Message</strong><br>${escapeHtml(input.message).replace(/\n/g, "<br>")}</p>` : ""}
    <p><a href="${escapeHtml(link)}">Review the request</a></p>
  `;
  for (const admin of admins) {
    try {
      const sent = await sendMail({ to: admin.email, subject, text, html });
      if (!sent) {
        console.info(`SMTP not configured; access request ${input.requestId} awaits review at ${link}`);
        break;
      }
    } catch (err) {
      console.error(`could not email ${admin.email} about access request ${input.requestId}`, err);
    }
  }
}
