"use client";

import * as React from "react";
import { UploadCloud, CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { ALLOWED_MIME_TYPES } from "@/data/document-categories";
import { Spinner } from "@/components/ui";

type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

const ACCEPT = Object.values(ALLOWED_MIME_TYPES)
  .flat()
  .map((ext) => `.${ext}`)
  .join(",");

function uploadFile(file: File, onProgress: (fraction: number) => void): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads/documents");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
        return;
      }
      let error = "The upload failed.";
      try {
        const body = JSON.parse(xhr.responseText) as { error?: string };
        if (body.error) error = body.error;
      } catch {
        if (xhr.status === 413) error = "The file is too large.";
      }
      resolve({ ok: false, error });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Network error. Check your connection and try again." });
    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

export function UploadArea({
  onUploaded,
  compact = false,
  maxMb,
}: {
  onUploaded: () => void;
  compact?: boolean;
  maxMb?: number;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [dragging, setDragging] = React.useState(false);

  const update = (id: string, patch: Partial<UploadItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const queued = list.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      progress: 0,
      status: "uploading" as const,
    }));
    setItems((prev) => [...queued, ...prev]);
    // Upload sequentially: simpler progress, kinder to the rate limit.
    for (let i = 0; i < list.length; i++) {
      const item = queued[i];
      const result = await uploadFile(list[i], (fraction) => update(item.id, { progress: fraction }));
      if (result.ok) {
        update(item.id, { status: "done", progress: 1 });
        onUploaded();
      } else {
        update(item.id, { status: "error", error: result.error });
      }
    }
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload documents"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors",
          compact ? "px-4 py-5" : "px-6 py-8",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface hover:bg-surface-muted",
        )}
      >
        <UploadCloud className="mb-2 size-6 text-ink-faint" aria-hidden="true" />
        <p className="text-sm font-medium text-ink">
          Drop files here or <span className="text-accent">browse</span>
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          PDF, Office, images, text or zip{maxMb ? ` · up to ${maxMb} MB each` : ""}. New files are <strong className="font-medium text-ink">private</strong> until you change their visibility.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="space-y-1.5" aria-live="polite">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-sm">
              {it.status === "uploading" ? (
                <Spinner className="size-4 shrink-0 text-ink-faint" />
              ) : it.status === "done" ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-danger" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-ink">{it.name}</span>
                  <span className="shrink-0 text-[13px] text-ink-faint">{formatBytes(it.size)}</span>
                </div>
                {it.status === "uploading" ? (
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-soft" aria-hidden="true">
                    <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${Math.round(it.progress * 100)}%` }} />
                  </div>
                ) : it.status === "error" ? (
                  <p className="text-[13px] text-danger">{it.error}</p>
                ) : (
                  <p className="text-[13px] text-ink-muted">Uploaded as private. Edit it to change the visibility.</p>
                )}
              </div>
              {it.status !== "uploading" ? (
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                  className="rounded-md p-1 text-ink-faint hover:bg-neutral-soft hover:text-ink"
                  aria-label={`Dismiss ${it.name}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
