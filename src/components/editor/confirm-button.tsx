"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/**
 * Two-step destructive button: the first click arms it, the second confirms.
 * Keeps removals quick without a modal, and disarms itself after a moment.
 */
export function ConfirmButton({
  children,
  confirmLabel = "Remove?",
  onConfirm,
  busy,
  size = "sm",
}: {
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  size?: "sm" | "md";
}) {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(id);
  }, [armed]);

  if (!armed) {
    return (
      <Button variant="ghost" size={size} onClick={() => setArmed(true)} disabled={busy}>
        {children}
      </Button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={confirmLabel}>
      <span className="px-1 text-[13px] text-ink-muted">{confirmLabel}</span>
      <Button
        variant="danger"
        size={size}
        loading={busy}
        onClick={async () => {
          await onConfirm();
          setArmed(false);
        }}
        autoFocus
      >
        Yes
      </Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)} disabled={busy}>
        Cancel
      </Button>
    </span>
  );
}
