import Link from "next/link";
import { ArrowRight, Inbox, FileText, Plug, Activity } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env, googleConfigured, microsoftConfigured } from "@/lib/env";
import { getPublished, hasUnpublishedChanges } from "@/lib/snapshot";
import { getDraft } from "@/lib/trust-center";
import { AUDIT_LABELS } from "@/lib/audit";
import { AdminContainer, PageHeader } from "@/components/admin/page-header";
import { Card, CardHeader, CardBody, Badge, Alert, buttonClasses } from "@/components/ui";
import { StatusCard } from "@/components/admin/dashboard/status-card";
import { relativeTime } from "@/components/admin/dashboard/relative-time";
import { visibilityLabel } from "@/data/document-categories";

export default async function AdminHome() {
  await requireAdmin();
  const [draft, published, pendingCount, pending, docCounts, integrations, activity] = await Promise.all([
    getDraft(),
    getPublished(),
    prisma.accessRequest.count({ where: { status: "PENDING" } }),
    prisma.accessRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { documents: { include: { document: { select: { title: true } } } } },
    }),
    prisma.document.groupBy({ by: ["visibility"], _count: { _all: true } }),
    prisma.integration.findMany({ select: { provider: true, accountEmail: true, accountName: true } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const unpublished = published ? await hasUnpublishedChanges() : false;
  const publicUrl = `${env().APP_URL.replace(/\/$/, "")}/`;
  const counts = { PUBLIC: 0, REQUEST: 0, PRIVATE: 0, ...Object.fromEntries(docCounts.map((c) => [c.visibility, c._count._all])) } as Record<
    "PUBLIC" | "REQUEST" | "PRIVATE",
    number
  >;
  const totalDocs = counts.PUBLIC + counts.REQUEST + counts.PRIVATE;
  const google = integrations.find((i) => i.provider === "GOOGLE_DRIVE");
  const microsoft = integrations.find((i) => i.provider === "ONEDRIVE");
  const firstRun = !draft.companyName.trim();

  return (
    <AdminContainer>
      <PageHeader title="Overview" description={draft.companyName ? `${draft.companyName} Trust Center` : undefined} />

      <div className="space-y-6">
        {firstRun ? (
          <Alert tone="info" title="Welcome. Let's set up your Trust Center.">
            <p>The guided setup walks you through your company details, compliance posture, subprocessors and documents in six short steps.</p>
            <Link href="/admin/edit/1" className={buttonClasses("primary", "md", "mt-3")}>
              Start the guided setup <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Alert>
        ) : null}

        <StatusCard
          published={published ? { version: published.version, publishedAt: published.publishedAt.toISOString() } : null}
          publicUrl={publicUrl}
          unpublishedChanges={unpublished}
        />

        <div className="grid items-start gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  Pending access requests
                  {pendingCount > 0 ? <Badge tone="warning">{pendingCount}</Badge> : null}
                </span>
              }
              action={
                <Link href="/admin/requests" className="text-sm font-medium text-accent hover:underline">
                  View all
                </Link>
              }
            />
            {pending.length === 0 ? (
              <CardBody>
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <Inbox className="size-4 text-ink-faint" aria-hidden="true" /> No pending requests. Requests from visitors appear here.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {pending.map((r) => (
                  <li key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {r.requesterName}
                        {r.company ? <span className="font-normal text-ink-muted"> · {r.company}</span> : null}
                      </p>
                      <p className="truncate text-[13px] text-ink-muted">
                        {r.documents.map((d) => d.document.title).join(", ") || "No documents"} · {relativeTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link href={`/admin/requests/${r.id}#approve`} className={buttonClasses("secondary", "sm")}>
                        Approve
                      </Link>
                      <Link href={`/admin/requests/${r.id}#reject`} className={buttonClasses("ghost", "sm")}>
                        Reject
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Documents"
                action={
                  <Link href="/admin/documents" className="text-sm font-medium text-accent hover:underline">
                    Manage
                  </Link>
                }
              />
              <CardBody>
                {totalDocs === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-ink-muted">
                    <FileText className="size-4 text-ink-faint" aria-hidden="true" /> No documents yet.
                  </p>
                ) : (
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    {(["PUBLIC", "REQUEST", "PRIVATE"] as const).map((v) => (
                      <div key={v}>
                        <dt className="text-[13px] text-ink-muted">{visibilityLabel(v)}</dt>
                        <dd className="text-lg font-semibold text-ink">{counts[v]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Integrations"
                action={
                  <Link href="/admin/integrations" className="text-sm font-medium text-accent hover:underline">
                    Manage
                  </Link>
                }
              />
              <CardBody className="space-y-2.5">
                <IntegrationRow name="Google Drive" configured={googleConfigured()} account={google?.accountEmail || google?.accountName} />
                <IntegrationRow name="OneDrive" configured={microsoftConfigured()} account={microsoft?.accountEmail || microsoft?.accountName} />
              </CardBody>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link href="/admin/activity" className="text-sm font-medium text-accent hover:underline">
                View all
              </Link>
            }
          />
          {activity.length === 0 ? (
            <CardBody>
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                <Activity className="size-4 text-ink-faint" aria-hidden="true" /> Nothing recorded yet.
              </p>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {AUDIT_LABELS[a.action] ?? a.action}
                    {a.actorLabel ? <span className="text-ink-muted"> · {a.actorLabel}</span> : null}
                  </span>
                  <time dateTime={a.createdAt.toISOString()} className="shrink-0 text-[13px] text-ink-faint">
                    {relativeTime(a.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminContainer>
  );
}

function IntegrationRow({ name, configured, account }: { name: string; configured: boolean; account?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-ink">
        <Plug className="size-4 text-ink-faint" aria-hidden="true" /> {name}
      </span>
      {account ? (
        <span className="truncate text-[13px] text-success" title={account}>
          Connected · {account}
        </span>
      ) : configured ? (
        <span className="text-[13px] text-ink-muted">Not connected</span>
      ) : (
        <span className="text-[13px] text-ink-faint">Not configured</span>
      )}
    </div>
  );
}
