"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "./steps";
import { useWizard } from "./wizard-context";

function stateOf(n: number, current: number): "done" | "current" | "upcoming" {
  if (n === current) return "current";
  return n < current ? "done" : "upcoming";
}

/** Small numbered marker shared by the rail and the compact stepper. */
function StepMarker({ n, state, className }: { n: number; state: "done" | "current" | "upcoming"; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-medium tabular-nums transition-colors duration-150",
        state === "done" && "bg-surface text-ink ring-1 ring-ink ring-inset",
        state === "current" && "bg-ink text-ink-inverse",
        state === "upcoming" && "bg-surface text-ink-faint ring-1 ring-line-strong ring-inset",
        className,
      )}
      aria-hidden="true"
    >
      {state === "done" ? <Check className="size-3" strokeWidth={2.5} /> : String(n).padStart(2, "0")}
    </span>
  );
}

/** Vertical rail for desktop. Every step is a link, so users can jump freely. */
export function StepperRail({ className }: { className?: string }) {
  const { step, goToStep, navigating } = useWizard();
  return (
    <nav aria-label="Editor steps" className={className}>
      <ol>
        {WIZARD_STEPS.map((s, i) => {
          const state = stateOf(s.n, step);
          const last = i === WIZARD_STEPS.length - 1;
          return (
            <li key={s.n} className="relative">
              {!last ? <span aria-hidden="true" className="absolute left-[11px] top-8 bottom-0 w-px bg-line-strong" /> : null}
              <button
                type="button"
                onClick={() => goToStep(s.n)}
                disabled={navigating}
                aria-current={state === "current" ? "step" : undefined}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-md py-1.5 pr-2 text-left transition-colors duration-150",
                  !last && "pb-5",
                )}
              >
                <StepMarker n={s.n} state={state} className="mt-px group-hover:ring-ink-faint" />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-sm leading-6 transition-colors",
                      state === "current" ? "font-medium text-ink" : state === "done" ? "text-ink group-hover:text-ink" : "text-ink-muted group-hover:text-ink",
                    )}
                  >
                    {s.title}
                  </span>
                  <span className="sr-only">
                    {state === "done" ? " (completed)" : state === "current" ? " (current step)" : ""}
                  </span>
                </span>
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
    <nav aria-label="Editor steps" className={cn("rounded-lg border border-line bg-surface px-4 py-3", className)}>
      <ol className="flex items-center gap-2">
        {WIZARD_STEPS.map((s) => {
          const state = stateOf(s.n, step);
          return (
            <li key={s.n} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                onClick={() => goToStep(s.n)}
                disabled={navigating}
                aria-label={`Step ${s.n}: ${s.title}${state === "done" ? " (completed)" : ""}`}
                aria-current={state === "current" ? "step" : undefined}
                className="rounded-full"
              >
                <StepMarker n={s.n} state={state} />
              </button>
              {s.n < WIZARD_STEPS.length ? (
                <span className={cn("h-px flex-1", s.n < step ? "bg-ink" : "bg-line")} aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-2.5 font-mono text-[11px] tracking-[0.02em] text-ink-faint">
        Step {step} of {WIZARD_STEPS.length} · <span className="text-ink">{current.title}</span>
      </p>
    </nav>
  );
}
