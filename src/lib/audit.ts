import { prisma } from "./db";

type AuditInput = {
  action: string;
  actorId?: string | null;
  actorLabel?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/** Record a sensitive operation. Never throws: auditing must not break the request. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        actorLabel: input.actorLabel ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ? (JSON.parse(JSON.stringify(input.metadata)) as object) : undefined,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "auth.setup": "Created the first administrator account",
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.logout": "Signed out",
  "auth.password_changed": "Changed password",
  "admin.created": "Added an administrator",
  "admin.deleted": "Removed an administrator",
  "trustcenter.published": "Published the Trust Center",
  "trustcenter.unpublished": "Unpublished the Trust Center",
  "document.uploaded": "Uploaded a document",
  "document.imported": "Imported a document",
  "document.updated": "Updated a document",
  "document.deleted": "Deleted a document",
  "document.visibility_changed": "Changed document visibility",
  "document.downloaded": "Document downloaded",
  "access_request.created": "Access request submitted",
  "access_request.approved": "Access request approved",
  "access_request.rejected": "Access request rejected",
  "access_request.revoked": "Access grant revoked",
  "integration.connected": "Connected an integration",
  "integration.disconnected": "Disconnected an integration",
};
