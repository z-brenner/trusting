import type { LucideIcon } from "lucide-react";
import { Building2, Globe2, ShieldCheck, Users, FileText, Rocket } from "lucide-react";

export const WIZARD_STEP_COUNT = 6;

export type WizardStepDef = {
  n: number;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: LucideIcon;
};

export const WIZARD_STEPS: WizardStepDef[] = [
  {
    n: 1,
    slug: "company",
    title: "Company information",
    shortTitle: "Company",
    description: "Tell visitors who you are and give your Trust Center its name, look and contact details.",
    icon: Building2,
  },
  {
    n: 2,
    slug: "subprocessors",
    title: "Subprocessors",
    shortTitle: "Subprocessors",
    description: "List the vendors that process personal data on your behalf and where they process it.",
    icon: Globe2,
  },
  {
    n: 3,
    slug: "compliance",
    title: "Compliance frameworks",
    shortTitle: "Compliance",
    description: "Show which laws, standards and reports apply to you, with an honest status for each.",
    icon: ShieldCheck,
  },
  {
    n: 4,
    slug: "people",
    title: "Contacts and credentials",
    shortTitle: "People",
    description: "Name the people visitors can reach and the professional credentials your team holds.",
    icon: Users,
  },
  {
    n: 5,
    slug: "documents",
    title: "Documentation",
    shortTitle: "Documents",
    description: "Upload or import policies, reports and certificates, and decide who may open each one.",
    icon: FileText,
  },
  {
    n: 6,
    slug: "publish",
    title: "Preview and publish",
    shortTitle: "Publish",
    description: "Check everything on desktop and mobile, then publish your Trust Center.",
    icon: Rocket,
  },
];

export function clampStep(step: number | string | undefined | null): number {
  const n = Math.trunc(Number(step));
  if (!Number.isFinite(n)) return 1;
  return Math.min(WIZARD_STEP_COUNT, Math.max(1, n));
}

export function stepDef(n: number): WizardStepDef {
  return WIZARD_STEPS[clampStep(n) - 1];
}

export function stepHref(n: number) {
  return `/admin/edit/${clampStep(n)}`;
}
