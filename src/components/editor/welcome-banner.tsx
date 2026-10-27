"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, X } from "lucide-react";
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
      className="relative mb-8 rounded-xl border border-line bg-surface p-5 shadow-xs sm:p-6"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss introduction"
        className="absolute right-3 top-3 rounded-md p-1 text-ink-faint hover:bg-neutral-soft hover:text-ink"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="welcome-title" className="text-base font-semibold text-ink">
            Welcome{companyName ? `, ${companyName}` : ""}. Let&apos;s build your Trust Center.
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Six short steps, about ten minutes. Everything saves as you go, and nothing is public until you publish in
            the last step.
          </p>
        </div>
      </div>
      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {WIZARD_STEPS.map((s) => (
          <li key={s.n} className="flex items-start gap-2.5 rounded-md bg-canvas px-3 py-2.5">
            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-ink-inverse">
              {s.n}
            </span>
            <span className="min-w-0 text-sm">
              <span className="block font-medium text-ink">{s.title}</span>
              <span className="block text-[13px] leading-5 text-ink-muted">{s.description}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-5">
        <button type="button" onClick={dismiss} className="text-sm font-medium text-accent hover:underline">
          Got it, start with step 1
        </button>
      </div>
    </section>
  );
}
