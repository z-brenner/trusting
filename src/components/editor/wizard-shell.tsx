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
      <div className="mx-auto w-full min-w-0 max-w-[1680px] px-4 py-6 sm:px-6 lg:py-10">
        <div className="flex gap-8 xl:gap-12">
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-[84px]">
              <p className="eyebrow mb-5">Set up your Trust Center</p>
              <StepperRail />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <StepperCompact className="mb-6 lg:hidden" />
            <header className="mb-10 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="eyebrow">
                  Step {def.n} of {WIZARD_STEP_COUNT}
                </p>
                <h1 className="font-display mt-2.5 text-[32px] leading-none text-ink">{def.title}</h1>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">{def.description}</p>
              </div>
              <SaveIndicator className="mt-0.5" />
            </header>
            <div className={cn("w-full", wide ? "max-w-[1100px]" : "max-w-[720px]")}>{children}</div>
          </main>

          {showPreview ? (
            <div className="hidden w-[400px] shrink-0 xl:block 2xl:w-[460px]">
              <PreviewPanel className="sticky top-[84px] h-[calc(100vh-7.5rem)]" />
            </div>
          ) : null}
        </div>
      </div>
    </WizardProvider>
  );
}
