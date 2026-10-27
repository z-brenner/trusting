"use client";

import * as React from "react";
import { ExternalLink, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWizard } from "./wizard-context";

export type PreviewDevice = "desktop" | "mobile";

/**
 * Live preview of the draft. Points at /preview and reloads whenever a save
 * succeeds (the query parameter changes with the wizard's previewKey).
 */
export function PreviewFrame({
  device = "desktop",
  className,
  height = "100%",
}: {
  device?: PreviewDevice;
  className?: string;
  height?: string | number;
}) {
  const { previewKey, bumpPreview } = useWizard();
  const [blocked, setBlocked] = React.useState(false);
  const [loadedKey, setLoadedKey] = React.useState<number | null>(null);
  const ref = React.useRef<HTMLIFrameElement>(null);
  const loading = loadedKey !== previewKey;

  // Some browsers never fire "load" for a frame refused by the server; check after a grace period.
  React.useEffect(() => {
    if (!loading) return;
    const id = window.setTimeout(() => {
      try {
        if (ref.current && !ref.current.contentDocument) setBlocked(true);
      } catch {
        setBlocked(true);
      }
    }, 6000);
    return () => window.clearTimeout(id);
  }, [loading, previewKey]);

  const onLoad = () => {
    setLoadedKey(previewKey);
    // Same-origin frames expose their document; a frame refused by X-Frame-Options does not.
    try {
      setBlocked(!ref.current?.contentDocument);
    } catch {
      setBlocked(true);
    }
  };

  const src = `/preview?k=${previewKey}`;
  const mobile = device === "mobile";

  return (
    <div className={cn("relative flex h-full w-full flex-col", className)} style={{ height }}>
      <div className={cn("relative min-h-0 flex-1", mobile && "flex justify-center overflow-auto py-4")}>
        <div
          className={cn(
            "relative h-full bg-surface",
            mobile
              ? "w-[390px] max-w-full shrink-0 overflow-hidden rounded-[28px] border-[6px] border-ink shadow-md"
              : "w-full overflow-hidden rounded-[10px] border border-line",
          )}
        >
          {blocked ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm font-medium text-ink">The preview cannot be embedded here.</p>
              <p className="max-w-xs text-sm text-ink-muted">
                This installation sends headers that block framing. You can still open the draft preview in a new tab.
              </p>
              <a href="/preview" target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
                Open preview <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <iframe
              key={previewKey}
              ref={ref}
              src={src}
              title="Live preview of your Trust Center"
              onLoad={onLoad}
              className="block h-full w-full bg-surface"
            />
          )}
          {loading && !blocked ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-line" aria-hidden="true">
              <div className="h-full w-1/3 animate-[preview-bar_1s_linear_infinite] bg-ink" />
            </div>
          ) : null}
        </div>
      </div>
      <style>{`@keyframes preview-bar{from{transform:translateX(-100%)}to{transform:translateX(300%)}}`}</style>
      <span className="sr-only" aria-live="polite">
        {loading ? "Reloading preview" : "Preview up to date"}
      </span>
      <button type="button" className="sr-only" onClick={bumpPreview}>
        Reload preview
      </button>
    </div>
  );
}

/** Header strip shared by the side panel and the step 6 preview. */
export function PreviewToolbar({
  device,
  onDeviceChange,
  compact,
}: {
  device?: PreviewDevice;
  onDeviceChange?: (d: PreviewDevice) => void;
  compact?: boolean;
}) {
  const { bumpPreview } = useWizard();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.06em] uppercase">
        <span className="text-ink">{compact ? "Live preview" : "Preview"}</span>
        <span aria-hidden="true" className="text-line-strong">
          ·
        </span>
        <span className="text-ink-faint">Draft</span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {device && onDeviceChange ? (
          <div role="radiogroup" aria-label="Preview device" className="mr-1 inline-flex rounded-md border border-line bg-canvas p-0.5">
            {(
              [
                { id: "desktop", label: "Desktop", Icon: Monitor },
                { id: "mobile", label: "Mobile", Icon: Smartphone },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={device === id}
                onClick={() => onDeviceChange(id)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium transition-colors duration-150",
                  device === id ? "bg-surface text-ink shadow-xs ring-1 ring-line" : "text-ink-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <Button variant="ghost" size="sm" onClick={bumpPreview} aria-label="Reload preview" title="Reload preview" className="px-2">
          <RefreshCw className="size-3.5" aria-hidden="true" />
        </Button>
        <a
          href="/preview"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-ink-muted transition-colors hover:bg-neutral-soft hover:text-ink"
        >
          Open <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

/** Right-hand column on xl screens: a thin device-like frame around the draft. */
export function PreviewPanel({ className }: { className?: string }) {
  return (
    <aside className={cn("flex flex-col rounded-xl border border-line bg-surface p-2", className)} aria-label="Live preview">
      <div className="px-2 pt-1 pb-2.5">
        <PreviewToolbar compact />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-[10px] bg-canvas">
        <PreviewFrame />
      </div>
    </aside>
  );
}
