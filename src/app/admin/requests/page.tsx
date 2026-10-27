import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AccessRequestStatus } from "@/generated/prisma/enums";
import { AdminContainer, PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/admin/requests/status-badge";
import { relativeTime, formatDateTime } from "@/components/admin/dashboard/relative-time";
import { cn } from "@/lib/utils";

const TABS: { value: AccessRequestStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function parseStatus(value: string | undefined): AccessRequestStatus {
  return TABS.some((t) => t.value === value) || value === "REVOKED" ? (value as AccessRequestStatus) : "PENDING";
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status: raw } = await searchParams;
  const status = parseStatus(raw);
  const [requests, counts] = await Promise.all([
    prisma.accessRequest.findMany({
      where: status === "APPROVED" ? { status: { in: ["APPROVED", "REVOKED"] } } : { status },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { documents: { include: { document: { select: { title: true } } } } },
    }),
    prisma.accessRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countFor = (s: AccessRequestStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <AdminContainer>
      <PageHeader title="Access requests" description="Visitors who asked to see restricted documents. Approvals send a time-limited link." />

      <nav aria-label="Request status" className="mb-4 flex gap-1 border-b border-line">
        {TABS.map((tab) => {
          const active = (status === "REVOKED" ? "APPROVED" : status) === tab.value;
          const count = tab.value === "APPROVED" ? countFor("APPROVED") + countFor("REVOKED") : countFor(tab.value);
          return (
            <Link
              key={tab.value}
              href={tab.value === "PENDING" ? "/admin/requests" : `/admin/requests?status=${tab.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
              {count > 0 ? <span className="rounded-full bg-neutral-soft px-1.5 text-xs text-ink-muted">{count}</span> : null}
            </Link>
          );
        })}
      </nav>

      {requests.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" aria-hidden="true" />}
          title={status === "PENDING" ? "No pending requests" : `No ${status.toLowerCase()} requests`}
          description={
            status === "PENDING"
              ? "When a visitor requests access to a document marked “Request access”, it shows up here for you to approve or reject."
              : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-line text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th className="px-4 py-2.5 font-medium">Requester</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 font-medium">Documents</th>
                <th className="px-3 py-2.5 font-medium">Submitted</th>
                {status !== "PENDING" ? <th className="px-3 py-2.5 font-medium">Status</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {requests.map((r) => (
                <tr key={r.id} className="group relative align-top hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link href={`/admin/requests/${r.id}`} className="font-medium text-ink after:absolute after:inset-0 hover:underline">
                      {r.requesterName}
                    </Link>
                    <p className="truncate text-[13px] text-ink-muted">{r.requesterEmail}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-1 text-[13px] text-ink-muted md:hidden">
                      {status !== "PENDING" ? <StatusBadge status={r.status} expiresAt={r.grantExpiresAt} /> : null}
                      {r.company ? `${r.company} · ` : ""}
                      {r.documents.length} {r.documents.length === 1 ? "document" : "documents"} · {relativeTime(r.createdAt)}
                    </p>
                  </td>
                  <td className="hidden px-3 py-3 text-ink-muted md:table-cell">{r.company || "—"}</td>
                  <td className="hidden max-w-sm px-3 py-3 text-ink-muted md:table-cell">
                    <span className="line-clamp-2">{r.documents.map((d) => d.document.title).join(", ") || "—"}</span>
                  </td>
                  <td className="hidden px-3 py-3 whitespace-nowrap text-ink-muted md:table-cell" title={formatDateTime(r.createdAt)}>
                    {relativeTime(r.createdAt)}
                  </td>
                  {status !== "PENDING" ? (
                    <td className="hidden px-3 py-3 md:table-cell">
                      <StatusBadge status={r.status} expiresAt={r.grantExpiresAt} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminContainer>
  );
}
