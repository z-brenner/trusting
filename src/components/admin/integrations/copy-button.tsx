"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label = "Copy", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          /* clipboard unavailable (insecure context); the value is visible anyway */
        }
      }}
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1 rounded-[6px] border border-line-strong bg-surface px-2 text-xs font-medium text-ink-muted shadow-xs transition-colors hover:bg-surface-muted hover:text-ink",
        className,
      )}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? "Copied" : label}
    </button>
  );
}
