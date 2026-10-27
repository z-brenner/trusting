"use client";

import * as React from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export function LogoUploader({
  initialUrl,
  onChange,
}: {
  /** Current logo URL, or null when none is set. */
  initialUrl: string | null;
  /** Called after a successful upload or removal so the preview can reload. */
  onChange?: (hasLogo: boolean) => void;
}) {
  const [url, setUrl] = React.useState<string | null>(initialUrl);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/uploads/logo", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; message?: string };
      if (!res.ok || !data.ok || !data.url) {
        setError(data.message ?? "The upload failed. Please try again.");
        return;
      }
      setUrl(data.url);
      onChange?.(true);
    } catch {
      setError("The upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/uploads/logo", { method: "DELETE" });
      if (!res.ok) {
        setError("The logo could not be removed. Please try again.");
        return;
      }
      setUrl(null);
      onChange?.(false);
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <div
          className={cn(
            "flex h-28 w-full items-center justify-center rounded-lg border border-line bg-canvas sm:w-44",
            !url && "border-dashed",
          )}
          aria-label={url ? "Current logo" : "No logo yet"}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- dynamic, same-origin image served by /api/logo
            <img src={url} alt="Company logo" className="max-h-20 max-w-[85%] object-contain" />
          ) : (
            <ImagePlus className="size-6 text-ink-faint" aria-hidden="true" />
          )}
        </div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-1 flex-col items-start justify-center gap-2 rounded-lg border border-dashed px-4 py-3 transition-colors duration-150",
            dragging ? "border-accent bg-accent-soft" : "border-line-strong bg-surface",
          )}
        >
          <p className="text-sm text-ink">
            Drag an image here, or{" "}
            <button
              type="button"
              className="font-medium text-accent hover:underline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              choose a file
            </button>
          </p>
          <p className="text-[13px] text-ink-muted">PNG, JPEG, WebP or SVG, up to 2 MB. A transparent PNG or SVG looks best.</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Upload logo"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} loading={busy}>
              <Upload className="size-3.5" aria-hidden="true" />
              {url ? "Replace logo" : "Upload logo"}
            </Button>
            {url ? (
              <Button variant="ghost" size="sm" onClick={remove} disabled={busy}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
