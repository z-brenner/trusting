"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  Presentation,
  Search,
  X,
} from "lucide-react";
import { Alert, Button, Checkbox, Dialog, EmptyState, Spinner } from "@/components/ui";
import { cn, formatBytes, formatDate } from "@/lib/utils";
import { PROVIDER_LABELS } from "./provider-icon";

export type DrivePickerProps = {
  provider: "google" | "microsoft";
  open: boolean;
  onClose: () => void;
  /** Called once at least one document was imported, so the caller can refresh its list. */
  onImported: () => void;
};

type RemoteFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  isFolder: boolean;
  webUrl: string | null;
};

type ListResponse = { files: RemoteFile[]; nextPageToken: string | null };
type ApiError = { error: string; message?: string };
type ImportResponse = {
  imported: { id: string; title: string; fileName: string }[];
  errors: { fileId: string; name: string | null; error: string }[];
};

type Crumb = { id: string | null; name: string };

/** One loaded listing: the folder/search it belongs to plus its accumulated pages. */
type Page = { key: string; files: RemoteFile[]; nextPageToken: string | null; error: ApiError | null };

/** Calls the files route; never throws except when aborted. */
async function fetchFiles(
  provider: "google" | "microsoft",
  label: string,
  options: { folderId: string | null; query: string; pageToken: string | null },
  signal?: AbortSignal,
): Promise<{ files: RemoteFile[]; nextPageToken: string | null; error: ApiError | null }> {
  const params = new URLSearchParams();
  if (options.query) params.set("q", options.query);
  else if (options.folderId) params.set("folder", options.folderId);
  if (options.pageToken) params.set("pageToken", options.pageToken);
  try {
    const res = await fetch(`/api/integrations/${provider}/files?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal,
    });
    const json = (await res.json().catch(() => ({}))) as Partial<ListResponse> & Partial<ApiError>;
    if (!res.ok) {
      return {
        files: [],
        nextPageToken: null,
        error: { error: json.error ?? "provider", message: json.message ?? `${label} could not be reached.` },
      };
    }
    return { files: json.files ?? [], nextPageToken: json.nextPageToken ?? null, error: null };
  } catch (err) {
    if (signal?.aborted) throw err;
    return {
      files: [],
      nextPageToken: null,
      error: { error: "network", message: "The server could not be reached. Check your connection and try again." },
    };
  }
}

const MAX_SELECTION = 20;

/**
 * The stateful body is mounted only while the picker is open (and re-keyed per provider), so
 * every opening starts from the root folder with an empty selection.
 */
export function DrivePicker(props: DrivePickerProps) {
  if (!props.open) return null;
  return <DrivePickerDialog key={props.provider} {...props} />;
}

function DrivePickerDialog({ provider, onClose, onImported }: Omit<DrivePickerProps, "open">) {
  const label = PROVIDER_LABELS[provider];
  const rootName = provider === "google" ? "My Drive" : "My files";

  const [crumbs, setCrumbs] = React.useState<Crumb[]>([{ id: null, name: rootName }]);
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState<Page | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [selected, setSelected] = React.useState<Map<string, RemoteFile>>(new Map());
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<ImportResponse | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  const folderId = crumbs[crumbs.length - 1]?.id ?? null;
  // Identifies the listing currently wanted; the page is stale (loading) while its key differs.
  const pageKey = `${folderId ?? ""}\u0000${query}`;
  const loading = page?.key !== pageKey;
  const files = loading ? [] : page.files;
  const nextPageToken = loading ? null : page.nextPageToken;
  const error = loading ? null : page.error;

  // Debounce the search box.
  React.useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch the first page whenever the folder or search term changes (or a retry clears the page).
  React.useEffect(() => {
    if (!loading || result) return;
    const controller = new AbortController();
    fetchFiles(provider, label, { folderId, query, pageToken: null }, controller.signal)
      .then((outcome) => setPage({ key: pageKey, ...outcome }))
      .catch(() => {
        /* aborted: a newer listing superseded this one */
      });
    return () => controller.abort();
  }, [loading, result, provider, label, folderId, query, pageKey]);

  function retry() {
    setPage(null);
  }

  async function loadMore() {
    if (!nextPageToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const outcome = await fetchFiles(provider, label, { folderId, query, pageToken: nextPageToken });
      setPage((current) => {
        if (!current || current.key !== pageKey) return current;
        if (outcome.error) return { ...current, error: outcome.error };
        return { ...current, files: [...current.files, ...outcome.files], nextPageToken: outcome.nextPageToken };
      });
    } finally {
      setLoadingMore(false);
    }
  }

  function openFolder(file: RemoteFile) {
    setSearch("");
    setQuery("");
    setCrumbs((c) => [...c, { id: file.id, name: file.name }]);
  }

  function goTo(index: number) {
    setSearch("");
    setQuery("");
    setCrumbs((c) => c.slice(0, index + 1));
  }

  function toggle(file: RemoteFile) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) next.delete(file.id);
      else if (next.size < MAX_SELECTION) next.set(file.id, file);
      return next;
    });
  }

  async function runImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch(`/api/integrations/${provider}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ fileIds: [...selected.keys()] }),
      });
      const json = (await res.json().catch(() => ({}))) as Partial<ImportResponse> & Partial<ApiError>;
      if (!res.ok) {
        setImportError(json.message ?? "The import failed. Please try again.");
        return;
      }
      const outcome: ImportResponse = { imported: json.imported ?? [], errors: json.errors ?? [] };
      setResult(outcome);
      setSelected(new Map());
      if (outcome.imported.length > 0) onImported();
    } catch {
      setImportError("The server could not be reached. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  const atMax = selected.size >= MAX_SELECTION;
  const searching = query.length > 0;

  const footer = result ? (
    <>
      <Button variant="secondary" onClick={() => setResult(null)}>
        Import more
      </Button>
      <Button onClick={onClose}>Done</Button>
    </>
  ) : (
    <>
      <p className="mr-auto self-center text-sm text-ink-muted" aria-live="polite">
        {selected.size === 0 ? "No files selected" : `${selected.size} selected`}
        {atMax ? <span className="text-warning"> · maximum {MAX_SELECTION} per import</span> : null}
      </p>
      <Button variant="secondary" onClick={onClose} disabled={importing}>
        Cancel
      </Button>
      <Button onClick={runImport} disabled={selected.size === 0} loading={importing}>
        Import{selected.size > 0 ? ` ${selected.size} ${selected.size === 1 ? "file" : "files"}` : ""}
      </Button>
    </>
  );

  return (
    <Dialog
      open
      onClose={() => (importing ? undefined : onClose())}
      title={`Import from ${label}`}
      description="Files are copied into private storage. They stay private until you change their visibility."
      size="lg"
      footer={footer}
      className="sm:w-full"
    >
      {result ? (
        <ImportResults result={result} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <nav aria-label="Folder" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
              {searching ? (
                <span className="flex items-center gap-1.5 truncate text-ink">
                  <Search className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                  Results for <span className="truncate font-medium">“{query}”</span>
                </span>
              ) : (
                crumbs.map((crumb, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <React.Fragment key={`${crumb.id ?? "root"}-${i}`}>
                      {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden="true" /> : null}
                      {last ? (
                        <span className="truncate font-medium text-ink" aria-current="location">
                          {crumb.name}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goTo(i)}
                          className="shrink-0 truncate rounded-sm text-ink-muted hover:text-ink hover:underline"
                        >
                          {crumb.name}
                        </button>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </nav>
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label}`}
                aria-label={`Search ${label}`}
                className="h-9 w-full rounded-md border border-line-strong bg-surface pr-8 pl-8 text-sm text-ink shadow-xs placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-ring [&::-webkit-search-cancel-button]:hidden"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1 text-ink-faint hover:text-ink"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-line">
            <div className="max-h-[min(55vh,440px)] overflow-y-auto" aria-busy={loading || undefined}>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
                  <Spinner className="size-4" /> Loading…
                </div>
              ) : error ? (
                <div className="p-4">
                  <Alert tone="danger" title={error.error === "reconnect" || error.error === "not_connected" ? `${label} needs to be reconnected` : "Could not load files"}>
                    <p>{error.message}</p>
                    <div className="mt-3 flex gap-2">
                      {error.error === "reconnect" || error.error === "not_connected" ? (
                        <Link href="/admin/integrations" className="text-sm font-medium text-accent hover:underline">
                          Open Integrations
                        </Link>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={retry}>
                          Try again
                        </Button>
                      )}
                    </div>
                  </Alert>
                </div>
              ) : files.length === 0 ? (
                <EmptyState
                  className="m-3 border-0"
                  icon={searching ? <Search className="size-6" /> : <Folder className="size-6" />}
                  title={searching ? "No matching files" : "This folder is empty"}
                  description={searching ? "Try a different name. Search looks at file names across the whole drive." : undefined}
                />
              ) : (
                <ul role="list" className="divide-y divide-line">
                  {files.map((file) =>
                    file.isFolder ? (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() => openFolder(file)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-muted"
                        >
                          <span className="size-4 shrink-0" aria-hidden="true" />
                          <Folder className="size-5 shrink-0 text-ink-faint" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">{file.name}</span>
                            <span className="block text-xs text-ink-faint">Folder{file.modifiedTime ? ` · ${formatDate(file.modifiedTime)}` : ""}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden="true" />
                        </button>
                      </li>
                    ) : (
                      <li key={file.id}>
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-muted",
                            selected.has(file.id) && "bg-accent-soft/60 hover:bg-accent-soft/60",
                            !selected.has(file.id) && atMax && "cursor-not-allowed opacity-60",
                          )}
                        >
                          <Checkbox
                            checked={selected.has(file.id)}
                            onChange={() => toggle(file)}
                            disabled={!selected.has(file.id) && atMax}
                            aria-label={`Select ${file.name}`}
                          />
                          <FileIcon mimeType={file.mimeType} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-ink">{file.name}</span>
                            <span className="block truncate text-xs text-ink-faint">{fileMeta(file)}</span>
                          </span>
                        </label>
                      </li>
                    ),
                  )}
                  {nextPageToken ? (
                    <li className="flex justify-center p-2">
                      <Button size="sm" variant="ghost" onClick={() => void loadMore()} loading={loadingMore}>
                        Load more
                      </Button>
                    </li>
                  ) : null}
                </ul>
              )}
            </div>
          </div>

          {importError ? (
            <Alert tone="danger" title="Import failed">
              {importError}
            </Alert>
          ) : null}
          <p className="text-xs text-ink-faint">
            Folders open on click; tick files to import them. Up to {MAX_SELECTION} files per import.
            {provider === "google" ? " Google Docs, Sheets and Slides are exported as PDF." : ""}
          </p>
        </div>
      )}
    </Dialog>
  );
}

function ImportResults({ result }: { result: ImportResponse }) {
  return (
    <div className="max-h-[min(60vh,520px)] space-y-4 overflow-y-auto">
      {result.imported.length > 0 ? (
        <Alert tone="success" title={`Imported ${result.imported.length} ${result.imported.length === 1 ? "document" : "documents"}`}>
          <p>They are private. Change the visibility on the Documents page when you are ready to share them.</p>
        </Alert>
      ) : null}
      {result.imported.length > 0 ? (
        <ul className="divide-y divide-line rounded-md border border-line">
          {result.imported.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-ink">{d.title}</span>
              <span className="hidden truncate text-xs text-ink-faint sm:block">{d.fileName}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {result.errors.length > 0 ? (
        <>
          <Alert tone="danger" title={`${result.errors.length} ${result.errors.length === 1 ? "file was" : "files were"} not imported`}>
            <p>Nothing was changed for these files. Fix the cause and try again.</p>
          </Alert>
          <ul className="divide-y divide-line rounded-md border border-line">
            {result.errors.map((e) => (
              <li key={e.fileId} className="flex items-start gap-3 px-3 py-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{e.name ?? "Unknown file"}</span>
                  <span className="block text-ink-muted">{e.error}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function fileMeta(file: RemoteFile): string {
  const parts: string[] = [];
  parts.push(typeLabel(file.mimeType));
  if (file.size !== null) parts.push(formatBytes(file.size));
  if (file.modifiedTime) parts.push(formatDate(file.modifiedTime));
  return parts.join(" · ");
}

function typeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/vnd.google-apps.document") return "Google Doc";
  if (mimeType === "application/vnd.google-apps.spreadsheet") return "Google Sheet";
  if (mimeType === "application/vnd.google-apps.presentation") return "Google Slides";
  if (mimeType === "application/vnd.google-apps.drawing") return "Google Drawing";
  if (mimeType.startsWith("application/vnd.google-apps.")) return "Google item";
  if (mimeType === "application/vnd.microsoft.package.oneNote") return "OneNote notebook";
  if (mimeType.startsWith("application/vnd.microsoft.package.")) return "Package";
  if (mimeType.includes("wordprocessingml") || mimeType === "application/msword") return "Word";
  if (mimeType.includes("spreadsheetml") || mimeType === "application/vnd.ms-excel" || mimeType === "text/csv") return "Spreadsheet";
  if (mimeType.includes("presentationml") || mimeType === "application/vnd.ms-powerpoint") return "Presentation";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.startsWith("text/")) return "Text";
  if (mimeType === "application/zip") return "Archive";
  return "File";
}

function FileIcon({ mimeType }: { mimeType: string }) {
  const kind = typeLabel(mimeType);
  const Icon =
    kind === "Image"
      ? FileImage
      : kind === "Spreadsheet" || kind === "Google Sheet"
        ? FileSpreadsheet
        : kind === "Presentation" || kind === "Google Slides"
          ? Presentation
          : kind === "PDF" || kind === "Word" || kind === "Google Doc" || kind === "Text"
            ? FileText
            : File;
  return <Icon className="size-5 shrink-0 text-ink-faint" aria-hidden="true" />;
}
