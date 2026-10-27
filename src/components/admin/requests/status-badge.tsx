import type { AccessRequestStatus } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui";
import { isExpired } from "@/components/admin/dashboard/relative-time";

export function StatusBadge({ status, expiresAt }: { status: AccessRequestStatus; expiresAt?: Date | null }) {
  if (status === "APPROVED") {
    const expired = isExpired(expiresAt);
    return <Badge tone={expired ? "neutral" : "success"}>{expired ? "Expired" : "Approved"}</Badge>;
  }
  if (status === "REJECTED") return <Badge tone="danger">Rejected</Badge>;
  if (status === "REVOKED") return <Badge tone="neutral">Revoked</Badge>;
  return <Badge tone="warning">Pending</Badge>;
}
