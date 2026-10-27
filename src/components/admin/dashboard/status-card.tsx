"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, PenLine, Eye } from "lucide-react";
import { Button, Card, Alert, buttonClasses } from "@/components/ui";
import { publishAction, unpublishAction } from "@/lib/actions/publish";
import { cn, formatDate } from "@/lib/utils";

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

/**
 * Publication status for the dashboard: a two-row panel. Left: status dot,
 * version and date, then the public URL. Right: the action row.
 */
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

  const stale = Boolean(unpublishedChanges && published);

  return (
    <Card>
      <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-full", published ? (stale ? "bg-warning" : "bg-success") : "bg-ink-faint")}
            />
            {published ? (
              <>
                <span className="font-medium text-ink">Published</span>
                <span className="text-ink-faint" aria-hidden="true">
                  ·
                </span>
                <span className="text-ink-muted">Version {published.version}</span>
                <span className="text-ink-faint" aria-hidden="true">
                  ·
                </span>
                <span className="text-ink-muted">{formatDate(published.publishedAt)}</span>
              </>
            ) : (
              <>
                <span className="font-medium text-ink">Draft</span>
                <span className="text-ink-faint" aria-hidden="true">
                  ·
                </span>
                <span className="text-ink-muted">Not published yet</span>
              </>
            )}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <code className="min-w-0 max-w-full truncate rounded-full border border-line bg-canvas px-3 py-1 font-mono text-[12px] text-ink-muted">
              {publicUrl}
            </code>
            <CopyButton value={publicUrl} />
            <a href={publicUrl} target="_blank" rel="noreferrer" className={buttonClasses("ghost", "sm")}>
              Open <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
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
      {stale || message ? (
        <div className="space-y-3 border-t border-line px-5 py-3.5">
          {stale && published ? (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
              You have unpublished changes. Visitors still see version {published.version}.
            </p>
          ) : null}
          {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        </div>
      ) : null}
    </Card>
  );
}
