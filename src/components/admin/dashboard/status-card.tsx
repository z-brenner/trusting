"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, PenLine, Eye } from "lucide-react";
import { Button, Card, CardBody, Badge, Alert, buttonClasses } from "@/components/ui";
import { publishAction, unpublishAction } from "@/lib/actions/publish";
import { formatDate } from "@/lib/utils";

export function CopyButton({ value, label = "Copy", size = "sm" }: { value: string; label?: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Button
      variant="secondary"
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          window.prompt("Copy this link", value);
        }
      }}
      aria-live="polite"
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function StatusCard({
  published,
  publicUrl,
  unpublishedChanges,
}: {
  published: { version: number; publishedAt: string } | null;
  publicUrl: string;
  unpublishedChanges: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"publish" | "unpublish" | null>(null);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function onPublish() {
    setPending("publish");
    setMessage(null);
    const result = await publishAction();
    setPending(null);
    if (result.ok) {
      setMessage({ tone: "success", text: `Published version ${result.version}. Visitors now see the latest content.` });
      router.refresh();
    } else {
      setMessage({ tone: "danger", text: result.message ?? "Publishing failed." });
    }
  }

  async function onUnpublish() {
    if (!window.confirm("Unpublish the Trust Center? Visitors will see a placeholder page until you publish again.")) return;
    setPending("unpublish");
    setMessage(null);
    await unpublishAction();
    setPending(null);
    setMessage({ tone: "success", text: "The Trust Center is no longer public." });
    router.refresh();
  }

  return (
    <Card>
      <CardBody className="space-y-4 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {published ? (
                <>
                  <Badge tone="success">Published</Badge>
                  <span className="text-sm text-ink-muted">
                    Version {published.version} · {formatDate(published.publishedAt)}
                  </span>
                </>
              ) : (
                <>
                  <Badge tone="neutral">Draft</Badge>
                  <span className="text-sm text-ink-muted">Not published yet</span>
                </>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="truncate rounded-md bg-surface-muted px-2 py-1 font-mono text-[13px] text-ink">{publicUrl}</code>
              <CopyButton value={publicUrl} />
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("ghost", "sm")}
              >
                Open <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/edit" className={buttonClasses("secondary", "md")}>
              <PenLine className="size-4" aria-hidden="true" /> Edit Trust Center
            </Link>
            <a href="/preview" target="_blank" rel="noreferrer" className={buttonClasses("secondary", "md")}>
              <Eye className="size-4" aria-hidden="true" /> Preview
            </a>
            <Button onClick={onPublish} loading={pending === "publish"} disabled={pending !== null}>
              {published ? "Update" : "Publish"}
            </Button>
            {published ? (
              <Button variant="ghost" onClick={onUnpublish} loading={pending === "unpublish"} disabled={pending !== null}>
                Unpublish
              </Button>
            ) : null}
          </div>
        </div>
        {unpublishedChanges && published ? (
          <p className="text-sm text-warning">You have unpublished changes. Visitors still see version {published.version}.</p>
        ) : null}
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      </CardBody>
    </Card>
  );
}
