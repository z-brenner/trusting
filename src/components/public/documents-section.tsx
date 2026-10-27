"use client";

import * as React from "react";
import { Download, ExternalLink, FileText, Lock } from "lucide-react";
import { RequestAccessDialog, type RequestableDocument } from "./request-access-dialog";
import { cn } from "@/lib/utils";

export type DocumentRow = {
  id: string;
  title: string;
  description: string;
  categoryLabel: string;
  visibility: "PUBLIC" | "REQUEST";
  versionLabel: string;
  /** Pre-formatted on the server to avoid locale/timezone hydration differences. */
  dateLabel: string;
  sizeLabel: string;
  /** For PUBLIC documents: whether it opens inline or downloads, with the pre-signed URL (absent in preview). */
  action: { kind: "download" | "open"; href: string | null } | { kind: "unavailable" } | null;
};

export type DocumentGroup = { category: string; label: string; documents: DocumentRow[] };

const PREVIEW_TITLE = "Available after publishing";

/**
 * Documents grouped by category with Open / Download / Request access actions.
 * In preview mode every action is inert.
 */
export function DocumentsSection({ groups, mode }: { groups: DocumentGroup[]; mode: "public" | "preview" }) {
  const requestable: RequestableDocument[] = groups.flatMap((g) =>
    g.documents.filter((d) => d.visibility === "REQUEST").map((d) => ({ id: d.id, title: d.title, categoryLabel: g.label })),
  );
  const [dialog, setDialog] = React.useState<{ open: boolean; preselect: string[] }>({ open: false, preselect: [] });
  const preview = mode === "preview";

  const openDialog = (preselect: string[]) => {
    if (preview) return;
    setDialog({ open: true, preselect });
  };

  const actionButtonClasses =
    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="space-y-6">
      {requestable.length > 0 ? (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,white)] text-[var(--brand-text)]" aria-hidden="true">
              <Lock className="size-4" />
            </span>
            <p className="max-w-xl text-sm leading-relaxed text-ink-muted">
              {requestable.length} {requestable.length === 1 ? "document is" : "documents are"} shared on request. Select the ones you need and we will review your
              request.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openDialog([])}
            disabled={preview}
            title={preview ? PREVIEW_TITLE : undefined}
            className={cn(
              actionButtonClasses,
              "h-9 border-transparent bg-[var(--brand)] px-4 text-[var(--brand-fg)] hover:brightness-95 disabled:hover:brightness-100",
            )}
          >
            Request access to documents
          </button>
        </div>
      ) : null}

      {groups.map((g) => (
        <section key={g.category} aria-labelledby={`doc-group-${g.category}`}>
          <h3 id={`doc-group-${g.category}`} className="eyebrow mb-3">
            {g.label}
          </h3>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {g.documents.map((d) => (
              <li key={d.id} id={`doc-${d.id}`} className="flex flex-col gap-3 px-5 py-4 transition-colors duration-150 hover:bg-surface-muted sm:flex-row sm:items-center sm:gap-5 sm:px-6">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted" aria-hidden="true">
                    {d.visibility === "REQUEST" ? <Lock className="size-4" /> : <FileText className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">{d.title}</p>
                    {d.description ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{d.description}</p> : null}
                    <p className="mt-1.5 font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                      {[d.versionLabel, d.dateLabel ? `Updated ${d.dateLabel}` : "", d.sizeLabel].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 sm:pl-2">
                  <DocumentAction row={d} preview={preview} onRequest={() => openDialog([d.id])} buttonClasses={actionButtonClasses} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!preview ? (
        <RequestAccessDialog
          open={dialog.open}
          onClose={() => setDialog((d) => ({ ...d, open: false }))}
          documents={requestable}
          initialSelection={dialog.preselect}
        />
      ) : null}
    </div>
  );
}

function DocumentAction({
  row,
  preview,
  onRequest,
  buttonClasses,
}: {
  row: DocumentRow;
  preview: boolean;
  onRequest: () => void;
  buttonClasses: string;
}) {
  const secondary = "border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-muted";

  if (row.visibility === "REQUEST") {
    return (
      <button type="button" onClick={onRequest} disabled={preview} title={preview ? PREVIEW_TITLE : undefined} className={cn(buttonClasses, secondary)}>
        <Lock className="size-3.5 text-ink-muted" aria-hidden="true" />
        Request access
      </button>
    );
  }

  if (!row.action || row.action.kind === "unavailable") {
    return <span className="text-[13px] text-ink-muted">View only</span>;
  }

  const label = row.action.kind === "open" ? "Open" : "Download";
  const Icon = row.action.kind === "open" ? ExternalLink : Download;

  if (preview || !row.action.href) {
    return (
      <button type="button" disabled title={preview ? PREVIEW_TITLE : "Not available"} className={cn(buttonClasses, secondary)}>
        <Icon className="size-3.5 text-ink-muted" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <a
      href={row.action.href}
      target={row.action.kind === "open" ? "_blank" : undefined}
      rel={row.action.kind === "open" ? "noopener noreferrer" : undefined}
      className={cn(buttonClasses, secondary)}
    >
      <Icon className="size-3.5 text-ink-muted" aria-hidden="true" />
      {label}
      <span className="sr-only">
        {" "}
        {row.title}
        {row.action.kind === "open" ? " (opens in a new tab)" : ""}
      </span>
    </a>
  );
}
