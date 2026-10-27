"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, ExternalLink, Globe, Minus } from "lucide-react";
import type { DocumentVisibility, FrameworkStatus } from "@/generated/prisma/enums";
import { Alert, Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FRAMEWORK_STATUS_LABELS, frameworkBySlug } from "@/data/frameworks";
import { visibilityLabel } from "@/data/document-categories";
import { publishAction, unpublishAction } from "@/lib/actions/publish";
import { formatDate } from "@/lib/utils";
import { expiryState } from "../people/people-step";
import { PreviewFrame, PreviewToolbar, type PreviewDevice } from "../preview-panel";
import { StepFooter } from "../step-footer";
import { stepHref } from "../steps";
import { useTrackedAction, useWizard } from "../wizard-context";

export type ReviewData = {
  companyName: string;
  hasLogo: boolean;
  frameworks: { slug: string; status: FrameworkStatus }[];
  subprocessors: { name: string; hasLocations: boolean }[];
  documents: { title: string; visibility: DocumentVisibility }[];
  contacts: { name: string; isPublished: boolean }[];
  certifications: { name: string; isPublished: boolean; expiresAt: Date | null }[];
};

type Tone = "ok" | "warn" | "neutral";

function ReviewRow({ tone, title, detail, fixHref, fixLabel }: { tone: Tone; title: string; detail?: React.ReactNode; fixHref?: string; fixLabel?: string }) {
  const { goToStep } = useWizard();
  const Icon = tone === "ok" ? Check : tone === "warn" ? AlertTriangle : Minus;
  return (
    <li className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted">
      <span
        className={
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full " +
          (tone === "ok" ? "bg-success-soft text-success" : tone === "warn" ? "bg-warning-soft text-warning" : "bg-neutral-soft text-ink-faint")
        }
        aria-hidden="true"
      >
        <Icon className="size-3" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {detail ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{detail}</p> : null}
      </div>
      {fixHref ? (
        <button
          type="button"
          onClick={() => goToStep(Number(fixHref.split("/").pop()))}
          className="shrink-0 text-[13px] font-medium text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          {fixLabel ?? "Edit"}
        </button>
      ) : null}
    </li>
  );
}

export function PublishStep({
  publicUrl,
  published,
  hasUnpublishedChanges,
  review,
}: {
  publicUrl: string;
  published: { version: number; publishedAt: Date } | null;
  hasUnpublishedChanges: boolean;
  review: ReviewData;
}) {
  const router = useRouter();
  const track = useTrackedAction();
  const { bumpPreview } = useWizard();
  const [device, setDevice] = React.useState<PreviewDevice>("desktop");
  const [busy, setBusy] = React.useState<"publish" | "unpublish" | null>(null);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const publish = async () => {
    setBusy("publish");
    setMessage(null);
    try {
      const result = await track(() => publishAction());
      if (result.ok) {
        setMessage({ tone: "success", text: `Version ${result.version} is live.` });
        bumpPreview();
        router.refresh();
      } else {
        setMessage({ tone: "danger", text: result.message ?? "Publishing failed." });
      }
    } finally {
      setBusy(null);
    }
  };

  const unpublish = async () => {
    setBusy("unpublish");
    setMessage(null);
    try {
      const result = await track(() => unpublishAction());
      setConfirmUnpublish(false);
      if (result.ok) {
        setMessage({ tone: "success", text: "Your Trust Center is no longer public." });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // Review checklist facts
  const statusCounts = review.frameworks.reduce<Partial<Record<FrameworkStatus, number>>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});
  const spMissing = review.subprocessors.filter((s) => !s.hasLocations).length;
  const docsByVisibility = review.documents.reduce<Record<DocumentVisibility, number>>(
    (acc, d) => {
      acc[d.visibility] += 1;
      return acc;
    },
    { PUBLIC: 0, REQUEST: 0, PRIVATE: 0 },
  );
  const contactsPublished = review.contacts.filter((c) => c.isPublished).length;
  const certsPublished = review.certifications.filter((c) => c.isPublished).length;
  const certsExpired = review.certifications.filter((c) => expiryState(c.expiresAt) === "expired").length;

  return (
    <div className="space-y-10">
      <section aria-label="Preview" className="rounded-xl border border-line bg-surface p-2">
        <div className="px-2 pt-1 pb-2.5">
          <PreviewToolbar device={device} onDeviceChange={setDevice} />
        </div>
        <div className="rounded-[10px] bg-canvas p-2 sm:p-3">
          <PreviewFrame device={device} height="min(72vh, 820px)" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader title="Review checklist" description="A quick scan before you publish. Nothing here blocks publishing." />
          <ul className="divide-y divide-line">
            <ReviewRow
              tone={review.companyName ? "ok" : "warn"}
              title={review.companyName ? `Company name: ${review.companyName}` : "Company name is missing"}
              detail={review.hasLogo ? "Logo uploaded." : "No logo yet; the title is shown as text."}
              fixHref={stepHref(1)}
            />
            <ReviewRow
              tone={review.frameworks.length ? "ok" : "neutral"}
              title={review.frameworks.length ? `${review.frameworks.length} compliance framework${review.frameworks.length === 1 ? "" : "s"}` : "No compliance frameworks"}
              detail={
                review.frameworks.length ? (
                  <>
                    {Object.entries(statusCounts)
                      .map(([status, n]) => `${n} ${FRAMEWORK_STATUS_LABELS[status as FrameworkStatus].label.toLowerCase()}`)
                      .join(", ")}
                    {" · "}
                    {review.frameworks.map((f) => frameworkBySlug(f.slug)?.shortName ?? f.slug).join(", ")}
                  </>
                ) : (
                  "Optional. Add laws, standards or reports that apply to you."
                )
              }
              fixHref={stepHref(3)}
            />
            <ReviewRow
              tone={review.subprocessors.length === 0 ? "neutral" : spMissing ? "warn" : "ok"}
              title={review.subprocessors.length ? `${review.subprocessors.length} subprocessor${review.subprocessors.length === 1 ? "" : "s"}` : "No subprocessors"}
              detail={
                review.subprocessors.length
                  ? spMissing
                    ? `${spMissing} without processing locations: ${review.subprocessors
                        .filter((s) => !s.hasLocations)
                        .map((s) => s.name)
                        .join(", ")}.`
                    : "All have processing locations."
                  : "Most companies use at least a hosting provider."
              }
              fixHref={stepHref(2)}
            />
            <ReviewRow
              tone={review.documents.length === 0 ? "neutral" : docsByVisibility.PUBLIC + docsByVisibility.REQUEST === 0 ? "warn" : "ok"}
              title={review.documents.length ? `${review.documents.length} document${review.documents.length === 1 ? "" : "s"}` : "No documents"}
              detail={
                review.documents.length ? (
                  <>
                    {(["PUBLIC", "REQUEST", "PRIVATE"] as DocumentVisibility[])
                      .filter((v) => docsByVisibility[v] > 0)
                      .map((v) => `${docsByVisibility[v]} ${visibilityLabel(v).toLowerCase()}`)
                      .join(", ")}
                    . Private documents are never published.
                  </>
                ) : (
                  "Policies and reports help visitors complete their reviews faster."
                )
              }
              fixHref={stepHref(5)}
            />
            <ReviewRow
              tone={review.contacts.length === 0 ? "neutral" : contactsPublished ? "ok" : "warn"}
              title={review.contacts.length ? `${contactsPublished} of ${review.contacts.length} contact${review.contacts.length === 1 ? "" : "s"} published` : "No contacts"}
              detail={review.contacts.length ? `${review.contacts.length - contactsPublished} hidden from visitors.` : "Give visitors someone to reach."}
              fixHref={stepHref(4)}
            />
            <ReviewRow
              tone={certsExpired ? "warn" : review.certifications.length ? "ok" : "neutral"}
              title={review.certifications.length ? `${certsPublished} of ${review.certifications.length} credential${review.certifications.length === 1 ? "" : "s"} published` : "No personnel credentials"}
              detail={certsExpired ? `${certsExpired} expired.` : review.certifications.length ? "All current." : "Optional."}
              fixHref={stepHref(4)}
            />
          </ul>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Publication" description={published ? `Version ${published.version} · published ${formatDate(published.publishedAt)}` : "Not published yet"} />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-2">
                {published ? <Badge tone="success">Live</Badge> : <Badge>Draft only</Badge>}
                {published && hasUnpublishedChanges ? <Badge tone="warning">Unpublished changes</Badge> : null}
              </div>
              {published && hasUnpublishedChanges ? (
                <p className="text-[13px] leading-relaxed text-ink-muted">Your draft differs from the live version. Publish again to update it.</p>
              ) : published ? (
                <p className="text-[13px] leading-relaxed text-ink-muted">The live version matches your draft.</p>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink-muted">Visitors see nothing until you publish. You can unpublish at any time.</p>
              )}
              {message ? (
                <Alert tone={message.tone}>{message.text}</Alert>
              ) : null}
              <div className="flex flex-col gap-2">
                <Button onClick={publish} loading={busy === "publish"} disabled={busy !== null}>
                  <Globe className="size-4" aria-hidden="true" />
                  {published ? "Update published version" : "Publish Trust Center"}
                </Button>
                {published ? (
                  <Button variant="secondary" onClick={() => setConfirmUnpublish(true)} disabled={busy !== null}>
                    Unpublish
                  </Button>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Public URL" />
            <CardBody className="space-y-3">
              <p className="break-all rounded-md border border-line bg-canvas px-3 py-2 font-mono text-[12px] text-ink-muted">{publicUrl}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={copy}>
                  {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy public URL"}
                </Button>
                <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-neutral-soft hover:text-ink">
                  Open <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Dialog
        open={confirmUnpublish}
        onClose={() => setConfirmUnpublish(false)}
        size="sm"
        title="Unpublish your Trust Center?"
        description="Visitors will see nothing at the public URL until you publish again. Your draft and previous versions are kept."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmUnpublish(false)} disabled={busy !== null}>
              Keep it live
            </Button>
            <Button variant="danger" onClick={unpublish} loading={busy === "unpublish"}>
              Unpublish
            </Button>
          </>
        }
      />

      <StepFooter />
    </div>
  );
}
