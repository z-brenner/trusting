"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PreviewPanel } from "./preview-panel";
import { SaveIndicator } from "./save-indicator";
import { StepperCompact, StepperRail } from "./stepper";
import { WIZARD_STEP_COUNT, stepDef } from "./steps";
import { WizardProvider } from "./wizard-context";

/**
 * Builder layout: left rail (desktop) / compact stepper (mobile), a 720px
 * form column and, on xl screens, the live preview. Step 6 renders its own
 * large preview, so the side panel is hidden there.
 */
export function WizardShell({
  step,
  children,
  wide = false,
  showPreview = true,
}: {
  step: number;
  children: React.ReactNode;
  wide?: boolean;
  showPreview?: boolean;
}) {
  const def = stepDef(step);
  return (
    <WizardProvider step={step}>
      <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:py-8">
        <div className="flex gap-8 xl:gap-10">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-20 space-y-4">
              <p className="px-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint">Set up your Trust Center</p>
              <StepperRail />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <StepperCompact className="mb-6 lg:hidden" />
            <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-ink-faint">
                  Step {def.n} of {WIZARD_STEP_COUNT}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{def.title}</h1>
                <p className="mt-1 text-sm text-ink-muted">{def.description}</p>
              </div>
              <SaveIndicator className="mt-1" />
            </header>
            <div className={cn("w-full", wide ? "max-w-[1100px]" : "max-w-[720px]")}>{children}</div>
          </main>

          {showPreview ? (
            <div className="hidden w-[400px] shrink-0 xl:block 2xl:w-[460px]">
              <PreviewPanel className="sticky top-20 h-[calc(100vh-6.5rem)]" />
            </div>
          ) : null}
        </div>
      </div>
    </WizardProvider>
  );
}
