"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "./steps";
import { useWizard } from "./wizard-context";

function stateOf(n: number, current: number): "done" | "current" | "upcoming" {
  if (n === current) return "current";
  return n < current ? "done" : "upcoming";
}

/** Vertical rail for desktop. Every step is a link, so users can jump freely. */
export function StepperRail({ className }: { className?: string }) {
  const { step, goToStep, navigating } = useWizard();
  return (
    <nav aria-label="Editor steps" className={className}>
      <ol className="space-y-1">
        {WIZARD_STEPS.map((s) => {
          const state = stateOf(s.n, step);
          const Icon = s.icon;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => goToStep(s.n)}
                disabled={navigating}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150",
                  state === "current" ? "bg-surface shadow-xs ring-1 ring-line" : "hover:bg-surface/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    state === "done" && "bg-success text-ink-inverse",
                    state === "current" && "bg-ink text-ink-inverse",
                    state === "upcoming" && "border border-line-strong text-ink-faint",
                  )}
                  aria-hidden="true"
                >
                  {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium leading-6", state === "upcoming" ? "text-ink-muted" : "text-ink")}>
                    {s.title}
                  </span>
                  <span className="sr-only">
                    {state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}
                  </span>
                </span>
                <Icon className={cn("ml-auto mt-1 size-4 shrink-0", state === "current" ? "text-ink-muted" : "text-ink-faint")} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Compact horizontal stepper for small screens. */
export function StepperCompact({ className }: { className?: string }) {
  const { step, goToStep, navigating } = useWizard();
  const current = WIZARD_STEPS[step - 1];
  return (
    <nav aria-label="Editor steps" className={cn("rounded-lg border border-line bg-surface px-3 py-2.5 shadow-xs", className)}>
      <ol className="flex items-center gap-1.5">
        {WIZARD_STEPS.map((s) => {
          const state = stateOf(s.n, step);
          return (
            <li key={s.n} className="flex flex-1 items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToStep(s.n)}
                disabled={navigating}
                aria-label={`Step ${s.n}: ${s.title}${state === "done" ? " (completed)" : ""}`}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-150",
                  state === "done" && "bg-success text-ink-inverse",
                  state === "current" && "bg-ink text-ink-inverse",
                  state === "upcoming" && "border border-line-strong text-ink-faint",
                )}
              >
                {state === "done" ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : s.n}
              </button>
              {s.n < WIZARD_STEPS.length ? (
                <span className={cn("h-px flex-1", s.n < step ? "bg-success" : "bg-line-strong")} aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">
        Step {step} of {WIZARD_STEPS.length} · <span className="font-medium text-ink">{current.title}</span>
      </p>
    </nav>
  );
}
