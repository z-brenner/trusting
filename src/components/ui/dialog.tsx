"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Accessible modal built on the native <dialog> element: focus trapping,
 * Escape handling and the backdrop come from the browser.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl" }[size];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-transparent open:animate-fade-in",
        sizes,
        className,
      )}
      aria-labelledby="dialog-title"
    >
      {open ? (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-ink-faint hover:bg-neutral-soft hover:text-ink"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="px-6 py-5">{children}</div>
          {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
