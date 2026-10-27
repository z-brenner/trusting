"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { setWizardStepAction } from "@/lib/actions/editor";
import { clampStep, stepHref } from "./steps";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type WizardContextValue = {
  step: number;
  saveStatus: SaveStatus;
  savedAt: number | null;
  /** Report the state of a save so the indicator and preview stay in sync. */
  setSaving: () => void;
  setSaved: () => void;
  setSaveError: () => void;
  /** Reload the preview iframe (after a successful save). */
  bumpPreview: () => void;
  previewKey: number;
  /** Persist the step and navigate to it. */
  goToStep: (n: number) => void;
  navigating: boolean;
  /** Steps register a guard that runs before Continue; return false to stay. */
  registerBeforeContinue: (fn: (() => Promise<boolean>) | null) => void;
  runBeforeContinue: () => Promise<boolean>;
};

const WizardContext = React.createContext<WizardContextValue | null>(null);

export function WizardProvider({ step, children }: { step: number; children: React.ReactNode }) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [previewKey, setPreviewKey] = React.useState(0);
  const [navigating, startTransition] = React.useTransition();
  const guard = React.useRef<(() => Promise<boolean>) | null>(null);

  const setSaving = React.useCallback(() => setSaveStatus("saving"), []);
  const setSaved = React.useCallback(() => {
    setSaveStatus("saved");
    setSavedAt(Date.now());
    setPreviewKey((k) => k + 1);
  }, []);
  const setSaveError = React.useCallback(() => setSaveStatus("error"), []);
  const bumpPreview = React.useCallback(() => setPreviewKey((k) => k + 1), []);

  const goToStep = React.useCallback(
    (n: number) => {
      const target = clampStep(n);
      startTransition(async () => {
        await setWizardStepAction(target).catch(() => undefined);
        router.push(stepHref(target));
      });
    },
    [router],
  );

  const registerBeforeContinue = React.useCallback((fn: (() => Promise<boolean>) | null) => {
    guard.current = fn;
  }, []);
  const runBeforeContinue = React.useCallback(async () => (guard.current ? guard.current() : true), []);

  const value = React.useMemo<WizardContextValue>(
    () => ({
      step,
      saveStatus,
      savedAt,
      setSaving,
      setSaved,
      setSaveError,
      bumpPreview,
      previewKey,
      goToStep,
      navigating,
      registerBeforeContinue,
      runBeforeContinue,
    }),
    [step, saveStatus, savedAt, setSaving, setSaved, setSaveError, bumpPreview, previewKey, goToStep, navigating, registerBeforeContinue, runBeforeContinue],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard() {
  const ctx = React.useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>");
  return ctx;
}

/**
 * Wrap a server-action call so the save indicator and preview update
 * automatically. Returns the action's result unchanged.
 */
export function useTrackedAction() {
  const { setSaving, setSaved, setSaveError } = useWizard();
  return React.useCallback(
    async <T extends { ok: boolean }>(run: () => Promise<T>): Promise<T> => {
      setSaving();
      try {
        const result = await run();
        if (result.ok) setSaved();
        else setSaveError();
        return result;
      } catch (err) {
        setSaveError();
        throw err;
      }
    },
    [setSaving, setSaved, setSaveError],
  );
}
