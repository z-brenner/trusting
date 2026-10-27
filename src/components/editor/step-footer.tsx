"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WIZARD_STEP_COUNT, WIZARD_STEPS } from "./steps";
import { useWizard } from "./wizard-context";

export function StepFooter({ continueLabel }: { continueLabel?: string }) {
  const { step, goToStep, navigating, runBeforeContinue } = useWizard();
  const [checking, setChecking] = React.useState(false);
  const next = step < WIZARD_STEP_COUNT ? WIZARD_STEPS[step] : null;
  const prev = step > 1 ? WIZARD_STEPS[step - 2] : null;

  const onContinue = async () => {
    if (!next) return;
    setChecking(true);
    try {
      const ok = await runBeforeContinue();
      if (ok) goToStep(next.n);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-12 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {prev ? (
          <Button variant="ghost" onClick={() => goToStep(prev.n)} disabled={navigating || checking} className="-ml-3">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
        ) : null}
      </div>
      {next ? (
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span className="hidden font-mono text-[11px] tracking-[0.02em] text-ink-faint sm:inline">Next: {next.title}</span>
          <Button onClick={onContinue} loading={navigating || checking}>
            {continueLabel ?? "Continue"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
