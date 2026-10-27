import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GRANT_DEFAULT_DAYS } from "@/lib/documents/access";
import { AdminContainer, PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardBody, Alert, Badge } from "@/components/ui";
import { StatusBadge } from "@/components/admin/requests/status-badge";
import { RequestActions } from "@/components/admin/requests/request-actions";
import { VisibilityPill } from "@/components/admin/documents/document-manager";
import { formatDateTime, isExpired } from "@/components/admin/dashboard/relative-time";
import { documentCategoryLabel } from "@/data/document-categories";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const request = await prisma.accessRequest.findUnique({
    where: { id },
    include: {
      documents: {
        include: { document: { select: { id: true, title: true, category: true, visibility: true, fileName: true } } },
      },
    },
  });
  if (!request) notFound();

  const decidedBy = request.decidedById
    ? await prisma.adminUser.findUnique({ where: { id: request.decidedById }, select: { name: true, email: true } })
    : null;
  const docs = request.documents.map((d) => d.document);
  const privateDocs = docs.filter((d) => d.visibility === "PRIVATE");
  const grantable = docs.filter((d) => d.visibility !== "PRIVATE");
  const expired = request.status === "APPROVED" && isExpired(request.grantExpiresAt);

  return (
    <AdminContainer className="max-w-5xl">
      <Link href="/admin/requests" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> All requests
      </Link>
      <PageHeader
        title={request.requesterName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} expiresAt={request.grantExpiresAt} />
            <span>
              {request.requesterEmail}
              {request.company ? ` · ${request.company}` : ""}
            </span>
          </span>
        }
      />

      <div className="space-y-4">
        {privateDocs.length > 0 && request.status === "PENDING" ? (
          <Alert tone="warning" title={`${privateDocs.length === 1 ? "One requested document is" : `${privateDocs.length} requested documents are`} now private`}>
            Private documents are never shared through an access link. {privateDocs.map((d) => d.title).join(", ")}{" "}
            {privateDocs.length === 1 ? "is" : "are"} excluded from the approval. Change the visibility first if you want to include{" "}
            {privateDocs.length === 1 ? "it" : "them"}.
          </Alert>
        ) : null}
        {expired ? <Alert tone="info">This access link has expired. Generate a new one if the requester still needs access.</Alert> : null}

        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Request" />
            <CardBody>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Item label="Name">{request.requesterName}</Item>
                <Item label="Email">
                  <a href={`mailto:${request.requesterEmail}`} className="text-accent hover:underline">
                    {request.requesterEmail}
                  </a>
                </Item>
                <Item label="Company">{request.company || "—"}</Item>
                <Item label="Submitted">{formatDateTime(request.createdAt)}</Item>
                <Item label="IP address">{request.ipAddress || "—"}</Item>
                {request.decidedAt ? (
                  <Item label="Decided">
                    {formatDateTime(request.decidedAt)}
                    {decidedBy ? <span className="text-ink-muted"> by {decidedBy.name}</span> : null}
                  </Item>
                ) : null}
                {request.status === "APPROVED" && request.grantExpiresAt ? (
                  <Item label="Link expires">{formatDateTime(request.grantExpiresAt)}</Item>
                ) : null}
                {request.decisionNote ? (
                  <Item label={request.status === "REJECTED" ? "Reason given" : "Internal note"} className="sm:col-span-2">
                    <span className="whitespace-pre-wrap">{request.decisionNote}</span>
                  </Item>
                ) : null}
              </dl>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[13px] font-medium text-ink-muted">Message</p>
                {request.message ? (
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink">{request.message}</p>
                ) : (
                  <p className="mt-1 text-sm text-ink-faint">No message.</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Requested documents" description={`${docs.length} ${docs.length === 1 ? "document" : "documents"}`} />
            {docs.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-faint">No documents are attached to this request.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                      <p className="text-[13px] text-ink-muted">{documentCategoryLabel(d.category)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <VisibilityPill visibility={d.visibility} />
                      {d.visibility === "PRIVATE" ? <Badge tone="danger">Excluded</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <RequestActions requestId={request.id} status={request.status} defaultDays={GRANT_DEFAULT_DAYS} grantableCount={grantable.length} />
      </div>
    </AdminContainer>
  );
}

function Item({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}
