"use client";

/**
 * Document library: list, upload, edit metadata, delete, and import from a
 * connected Google Drive / OneDrive account. Used on /admin/documents
 * (variant "page") and embedded in wizard step 5 (variant "wizard").
 */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, Cloud, Pencil, Trash2, ExternalLink } from "lucide-react";
import type { Document } from "@/generated/prisma/client";
import type { DocumentCategory, DocumentVisibility } from "@/generated/prisma/enums";
import { Button, Badge, Input, Select, EmptyState, Alert } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { DOCUMENT_CATEGORIES, VISIBILITY_OPTIONS, documentCategoryLabel, visibilityLabel } from "@/data/document-categories";
import { DrivePicker } from "@/components/admin/integrations/drive-picker";
import { deleteDocumentAction, getDocumentOpenUrlAction } from "@/lib/actions/documents";
import { formatBytes, formatDate, cn } from "@/lib/utils";
import { UploadArea } from "./upload-area";
import { DocumentEditDialog } from "./document-edit-dialog";

/** Everything the UI needs; storage keys and hashes never leave the server. */
export type DocumentListItem = Omit<Document, "storageKey" | "sha256">;

export type DocumentManagerProps = {
  documents: DocumentListItem[];
  integrations: { google: boolean; microsoft: boolean };
  /** "wizard" hides the page header and keeps the layout compact. */
  variant?: "page" | "wizard";
  /** Upload size limit shown in the drop zone. */
  maxUploadMb?: number;
};

const VISIBILITY_TONE: Record<DocumentVisibility, BadgeTone> = { PUBLIC: "success", REQUEST: "warning", PRIVATE: "neutral" };
const SOURCE_LABEL: Record<Document["source"], string> = { UPLOAD: "Upload", GOOGLE_DRIVE: "Google Drive", ONEDRIVE: "OneDrive" };

export function VisibilityPill({ visibility }: { visibility: DocumentVisibility }) {
  return <Badge tone={VISIBILITY_TONE[visibility]}>{visibilityLabel(visibility)}</Badge>;
}

export function DocumentManager({ documents, integrations, variant = "page", maxUploadMb }: DocumentManagerProps) {
  const router = useRouter();
  const compact = variant === "wizard";
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<DocumentCategory | "">("");
  const [visibility, setVisibility] = React.useState<DocumentVisibility | "">("");
  const [editing, setEditing] = React.useState<DocumentListItem | null>(null);
  const [picker, setPicker] = React.useState<"google" | "microsoft" | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => router.refresh(), [router]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (category && d.category !== category) return false;
      if (visibility && d.visibility !== visibility) return false;
      if (q && !`${d.title} ${d.fileName} ${d.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, query, category, visibility]);

  const hasFilters = Boolean(query || category || visibility);

  async function onOpen(doc: DocumentListItem) {
    setBusyId(doc.id);
    setError(null);
    const result = await getDocumentOpenUrlAction(doc.id);
    setBusyId(null);
    if (result.ok) {
      window.open(result.url, "_blank", "noopener");
    } else {
      setError(result.message);
    }
  }

  async function onDelete(doc: DocumentListItem) {
    const extra = doc.visibility !== "PRIVATE" ? " It is currently visible to visitors." : "";
    if (!window.confirm(`Delete "${doc.title}"? The file is removed permanently.${extra}`)) return;
    setBusyId(doc.id);
    setError(null);
    const result = await deleteDocumentAction(doc.id);
    setBusyId(null);
    if (!result.ok) setError(result.message ?? "Could not delete the document.");
    refresh();
  }

  const importButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {integrations.google ? (
        <Button variant="secondary" size={compact ? "sm" : "md"} onClick={() => setPicker("google")}>
          <Cloud className="size-4" aria-hidden="true" /> Import from Google Drive
        </Button>
      ) : null}
      {integrations.microsoft ? (
        <Button variant="secondary" size={compact ? "sm" : "md"} onClick={() => setPicker("microsoft")}>
          <Cloud className="size-4" aria-hidden="true" /> Import from OneDrive
        </Button>
      ) : null}
      {!integrations.google && !integrations.microsoft ? (
        <p className="text-[13px] text-ink-faint">
          Keep documents in Google Drive or OneDrive?{" "}
          <Link href="/admin/integrations" className="text-ink-muted underline underline-offset-2 hover:text-ink">
            Connect an integration
          </Link>{" "}
          to import them.
        </p>
      ) : null}
    </div>
  );

  return (
    <div className={cn("space-y-5", compact && "space-y-4")}>
      <UploadArea onUploaded={refresh} compact={compact} maxMb={maxUploadMb} />
      {importButtons}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" aria-hidden="true" />}
          title="No documents yet"
          description="Upload your security policy, privacy policy, DPA or audit reports. Everything stays private until you decide who can see it."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documents"
                aria-label="Search documents"
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory | "")} aria-label="Filter by category" className="sm:w-52">
                <option value="">All categories</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <Select value={visibility} onChange={(e) => setVisibility(e.target.value as DocumentVisibility | "")} aria-label="Filter by visibility" className="sm:w-40">
                <option value="">All visibility</option>
                {VISIBILITY_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
              No documents match{hasFilters ? " these filters" : ""}.
            </p>
          ) : (
            <>
              {/* Table for wider screens (page variant only; the wizard column is too narrow) */}
              <div className={cn("hidden overflow-x-auto rounded-lg border border-line bg-surface", !compact && "md:block")}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                      <th className="px-4 py-2.5 font-medium">Document</th>
                      <th className="px-3 py-2.5 font-medium">Category</th>
                      <th className="px-3 py-2.5 font-medium">Visibility</th>
                      {!compact ? <th className="px-3 py-2.5 font-medium">Downloads</th> : null}
                      <th className="px-3 py-2.5 font-medium">Version</th>
                      {!compact ? <th className="px-3 py-2.5 font-medium">Size</th> : null}
                      {!compact ? <th className="px-3 py-2.5 font-medium">Source</th> : null}
                      <th className="px-3 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((doc) => (
                      <tr key={doc.id} className="align-top">
                        <td className="max-w-xs px-4 py-3">
                          <p className="truncate font-medium text-ink" title={doc.title}>
                            {doc.title}
                          </p>
                          <p className="truncate text-[13px] text-ink-muted" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-ink-muted">{documentCategoryLabel(doc.category)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <VisibilityPill visibility={doc.visibility} />
                        </td>
                        {!compact ? (
                          <td className="px-3 py-3 whitespace-nowrap text-ink-muted">{doc.allowDownload ? "Allowed" : "View only"}</td>
                        ) : null}
                        <td className="min-w-32 px-3 py-3 text-ink-muted">
                          {doc.versionLabel ? <span className="text-ink">{doc.versionLabel}</span> : null}
                          {doc.versionLabel && doc.documentDate ? " · " : ""}
                          {doc.documentDate ? formatDate(doc.documentDate) : doc.versionLabel ? "" : "—"}
                        </td>
                        {!compact ? <td className="px-3 py-3 whitespace-nowrap text-ink-muted">{formatBytes(doc.sizeBytes)}</td> : null}
                        {!compact ? <td className="px-3 py-3 whitespace-nowrap text-ink-muted">{SOURCE_LABEL[doc.source]}</td> : null}
                        <td className="px-3 py-2.5 whitespace-nowrap text-right">
                          <RowActions doc={doc} busy={busyId === doc.id} iconOnly onEdit={() => setEditing(doc)} onOpen={() => onOpen(doc)} onDelete={() => onDelete(doc)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stacked cards for small screens and the wizard */}
              <ul className={cn("space-y-2", !compact && "md:hidden")}>
                {filtered.map((doc) => (
                  <li key={doc.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{doc.title}</p>
                        <p className="truncate text-[13px] text-ink-muted">{doc.fileName}</p>
                      </div>
                      <VisibilityPill visibility={doc.visibility} />
                    </div>
                    <p className="mt-2 text-[13px] text-ink-muted">
                      {documentCategoryLabel(doc.category)} · {formatBytes(doc.sizeBytes)} · {SOURCE_LABEL[doc.source]}
                      {doc.versionLabel ? ` · ${doc.versionLabel}` : ""}
                      {doc.documentDate ? ` · ${formatDate(doc.documentDate)}` : ""}
                    </p>
                    <div className="mt-2 flex justify-end">
                      <RowActions doc={doc} busy={busyId === doc.id} onEdit={() => setEditing(doc)} onOpen={() => onOpen(doc)} onDelete={() => onDelete(doc)} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!compact ? (
            <p className="text-[13px] text-ink-faint">
              {filtered.length === documents.length ? `${documents.length} ${documents.length === 1 ? "document" : "documents"}` : `${filtered.length} of ${documents.length} documents`}
            </p>
          ) : null}
        </div>
      )}

      {editing ? <DocumentEditDialog document={editing} onClose={() => setEditing(null)} onSaved={refresh} /> : null}
      {picker ? <DrivePicker provider={picker} open onClose={() => setPicker(null)} onImported={refresh} /> : null}
    </div>
  );
}

function RowActions({
  doc,
  busy,
  iconOnly = false,
  onEdit,
  onOpen,
  onDelete,
}: {
  doc: DocumentListItem;
  busy: boolean;
  iconOnly?: boolean;
  onEdit: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const cls = iconOnly ? "px-2" : undefined;
  return (
    <div className="inline-flex items-center gap-0.5">
      <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy} aria-label={`Edit ${doc.title}`} title="Edit" className={cls}>
        <Pencil className="size-4" aria-hidden="true" />
        {iconOnly ? null : "Edit"}
      </Button>
      <Button variant="ghost" size="sm" onClick={onOpen} disabled={busy} aria-label={`Open ${doc.title}`} title="Open" className={cls}>
        <ExternalLink className="size-4" aria-hidden="true" />
        {iconOnly ? null : "Open"}
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={busy} aria-label={`Delete ${doc.title}`} title="Delete" className={cn("hover:text-danger", cls)}>
        <Trash2 className="size-4" aria-hidden="true" />
        {iconOnly ? null : "Delete"}
      </Button>
    </div>
  );
}
