import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AUDIT_LABELS } from "@/lib/audit";
import { AdminContainer, PageHeader } from "@/components/admin/page-header";
import { EmptyState, buttonClasses } from "@/components/ui";
import { formatDateTime, summarizeMetadata } from "@/components/admin/dashboard/relative-time";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;
const PREFIXES = [
  { value: "", label: "All activity" },
  { value: "auth", label: "Sign-in and accounts" },
  { value: "document", label: "Documents" },
  { value: "access_request", label: "Access requests" },
  { value: "trustcenter", label: "Publishing" },
  { value: "integration", label: "Integrations" },
  { value: "admin", label: "Administrators" },
] as const;

type Prefix = (typeof PREFIXES)[number]["value"];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const prefix: Prefix = PREFIXES.some((p) => p.value === sp.type) ? (sp.type as Prefix) : "";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? "1", 10) || 1));
  const where = prefix ? { action: { startsWith: `${prefix}.` } } : {};
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/admin/activity?${new URLSearchParams({ ...(prefix ? { type: prefix } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`.replace(/\?$/, "");

  return (
    <AdminContainer className="max-w-5xl">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> Overview
      </Link>
      <PageHeader
        title="Activity"
        description="Every sensitive operation on this Trust Center, newest first."
        actions={
          <form method="get" action="/admin/activity" className="flex items-center gap-2">
            <label htmlFor="type" className="sr-only">
              Filter by type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={prefix}
              className="h-9 rounded-md border border-line-strong bg-surface px-3 pr-8 text-sm text-ink shadow-xs focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring"
            >
              {PREFIXES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClasses("secondary", "md")}>
              Filter
            </button>
          </form>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Activity className="size-6" aria-hidden="true" />} title="Nothing recorded" description="Actions appear here as administrators and visitors use the Trust Center." />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-line bg-surface">
            <table className="w-full text-sm">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-line text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Actor</th>
                  <th className="px-3 py-2.5 font-medium">Target</th>
                  <th className="px-3 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => {
                  const details = summarizeMetadata(r.metadata);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="hidden px-4 py-2.5 whitespace-nowrap text-ink-muted md:table-cell">
                        <time dateTime={r.createdAt.toISOString()}>{formatDateTime(r.createdAt)}</time>
                      </td>
                      <td className="px-4 py-2.5 md:px-3">
                        <span className="font-medium text-ink">{AUDIT_LABELS[r.action] ?? r.action}</span>
                        <span className="mt-0.5 block text-[13px] text-ink-muted md:hidden">
                          {formatDateTime(r.createdAt)}
                          {r.actorLabel ? ` · ${r.actorLabel}` : ""}
                        </span>
                        {details ? <span className="mt-0.5 block truncate text-[13px] text-ink-faint md:hidden">{details}</span> : null}
                      </td>
                      <td className="hidden max-w-48 truncate px-3 py-2.5 text-ink-muted md:table-cell" title={r.actorLabel ?? undefined}>
                        {r.actorLabel ?? <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="hidden px-3 py-2.5 whitespace-nowrap text-ink-muted md:table-cell">
                        {r.targetType ? (
                          <TargetLink type={r.targetType} id={r.targetId} />
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="hidden max-w-md px-3 py-2.5 text-[13px] text-ink-muted md:table-cell">
                        <span className="line-clamp-2">{details || <span className="text-ink-faint">—</span>}</span>
                        {r.ipAddress && r.ipAddress !== "unknown" ? <span className="block text-ink-faint">IP {r.ipAddress}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-ink-muted">
            <span>
              {total} {total === 1 ? "entry" : "entries"} · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <Link href={href(page - 1)} aria-disabled={page <= 1} className={cn(buttonClasses("secondary", "sm"), page <= 1 && "pointer-events-none opacity-50")}>
                Previous
              </Link>
              <Link href={href(page + 1)} aria-disabled={page >= pages} className={cn(buttonClasses("secondary", "sm"), page >= pages && "pointer-events-none opacity-50")}>
                Next
              </Link>
            </div>
          </div>
        </>
      )}
    </AdminContainer>
  );
}

function TargetLink({ type, id }: { type: string; id: string | null }) {
  const label = type.replace(/_/g, " ");
  if (!id) return <span>{label}</span>;
  if (type === "access_request") {
    return (
      <Link href={`/admin/requests/${id}`} className="text-accent hover:underline">
        {label}
      </Link>
    );
  }
  if (type === "document") {
    return (
      <Link href="/admin/documents" className="text-accent hover:underline">
        {label}
      </Link>
    );
  }
  return <span title={id}>{label}</span>;
}
