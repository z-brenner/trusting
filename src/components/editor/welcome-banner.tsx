"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { WIZARD_STEPS } from "./steps";

/** Friendly introduction shown once after setup (?welcome=1). */
export function WelcomeBanner({ companyName }: { companyName: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(params.get("welcome") === "1");
  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    router.replace("/admin/edit/1", { scroll: false });
  };

  return (
    <section
      aria-labelledby="welcome-title"
      className="relative mb-10 rounded-lg border border-line bg-surface p-5 sm:p-6"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss introduction"
        className="absolute top-3 right-3 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-neutral-soft hover:text-ink"
      >
        <X className="size-4" />
      </button>
      <div className="min-w-0 pr-8">
        <h2 id="welcome-title" className="font-display text-[24px] leading-tight text-ink">
          Welcome{companyName ? `, ${companyName}` : ""}. Let&apos;s build your Trust Center.
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-ink-muted">
          Six short steps, about ten minutes. Everything saves as you go, and nothing is public until you publish in
          the last step.
        </p>
      </div>
      <ol className="mt-5 grid gap-x-6 border-t border-line pt-5 sm:grid-cols-2">
        {WIZARD_STEPS.map((s) => (
          <li key={s.n} className="flex items-start gap-3 py-2">
            <span className="mt-0.5 font-mono text-[11px] font-medium tabular-nums text-ink-faint" aria-hidden="true">
              {String(s.n).padStart(2, "0")}
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium text-ink">{s.title}</span>
              <span className="block text-[13px] leading-5 text-ink-muted">{s.description}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4">
        <button type="button" onClick={dismiss} className="text-sm font-medium text-accent hover:underline">
          Got it, start with step 1
        </button>
      </div>
    </section>
  );
}
