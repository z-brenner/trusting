"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useWizard } from "./wizard-context";

function relative(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

/** Quiet autosave status: a small dot plus mono text. */
export function SaveIndicator({ className }: { className?: string }) {
  const { saveStatus, savedAt } = useWizard();
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    if (saveStatus !== "saved") return;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [saveStatus, savedAt]);

  if (saveStatus === "idle") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-7 items-center gap-2 font-mono text-[11px] tracking-[0.02em] transition-colors duration-150",
        {
          "text-ink-faint": saveStatus === "saving",
          "text-ink-muted": saveStatus === "saved",
          "text-danger": saveStatus === "error",
        },
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", {
          "animate-pulse bg-ink-faint": saveStatus === "saving",
          "bg-success": saveStatus === "saved",
          "bg-danger": saveStatus === "error",
        })}
      />
      {saveStatus === "saving" ? (
        <>Saving…</>
      ) : saveStatus === "saved" ? (
        <>Saved · {savedAt ? relative(savedAt, Math.max(now, savedAt)) : "just now"}</>
      ) : (
        <>Could not save</>
      )}
    </div>
  );
}
