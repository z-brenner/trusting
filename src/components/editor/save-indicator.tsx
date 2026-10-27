"use client";

import * as React from "react";
import { Check, CloudOff } from "lucide-react";
import { Spinner } from "@/components/ui/button";
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
      className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors duration-150", {
        "bg-neutral-soft text-ink-muted": saveStatus === "saving",
        "bg-success-soft text-success": saveStatus === "saved",
        "bg-danger-soft text-danger": saveStatus === "error",
      }, className)}
    >
      {saveStatus === "saving" ? (
        <>
          <Spinner className="size-3" /> Saving…
        </>
      ) : saveStatus === "saved" ? (
        <>
          <Check className="size-3.5" aria-hidden="true" /> Saved · {savedAt ? relative(savedAt, Math.max(now, savedAt)) : "just now"}
        </>
      ) : (
        <>
          <CloudOff className="size-3.5" aria-hidden="true" /> Could not save
        </>
      )}
    </div>
  );
}
