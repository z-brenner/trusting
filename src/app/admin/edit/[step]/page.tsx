import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getDraftWithRelations } from "@/lib/trust-center";
import { getPublished, hasUnpublishedChanges } from "@/lib/snapshot";
import { WizardShell } from "@/components/editor/wizard-shell";
import { WIZARD_STEP_COUNT, stepDef } from "@/components/editor/steps";
import { CompanyStep } from "@/components/editor/company/company-step";
import { SubprocessorsStep } from "@/components/editor/subprocessors/subprocessors-step";
import { FrameworksStep } from "@/components/editor/frameworks/frameworks-step";
import { PeopleStep } from "@/components/editor/people/people-step";
import { DocumentsStep } from "@/components/editor/documents-step";
import { PublishStep } from "@/components/editor/publish/publish-step";

export const dynamic = "force-dynamic";

type Params = { step: string };

function parseStep(raw: string): number | null {
  if (!/^[1-6]$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= WIZARD_STEP_COUNT ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const step = parseStep((await params).step);
  return { title: step ? `${stepDef(step).title} · Edit` : "Edit" };
}

export default async function EditStepPage({ params }: { params: Promise<Params> }) {
  await requireAdmin();
  const step = parseStep((await params).step);
  if (!step) notFound();

  const draft = await getDraftWithRelations();

  if (step === 1) {
    return (
      <WizardShell step={1}>
        <CompanyStep
          hasLogo={Boolean(draft.logoKey)}
          initial={{
            companyName: draft.companyName,
            legalName: draft.legalName,
            title: draft.title,
            tagline: draft.tagline,
            description: draft.description,
            websiteUrl: draft.websiteUrl,
            primaryColor: draft.primaryColor,
            secondaryColor: draft.secondaryColor,
            address: draft.address,
            registrationNumber: draft.registrationNumber,
            industry: draft.industry,
            contactEmail: draft.contactEmail,
            contactPhone: draft.contactPhone,
            contactNote: draft.contactNote,
            showMap: draft.showMap,
          }}
        />
      </WizardShell>
    );
  }

  if (step === 2) {
    return (
      <WizardShell step={2}>
        <SubprocessorsStep subprocessors={draft.subprocessors} primaryColor={draft.primaryColor} />
      </WizardShell>
    );
  }

  if (step === 3) {
    return (
      <WizardShell step={3}>
        <FrameworksStep
          entries={draft.frameworks.map((f) => ({
            id: f.id,
            frameworkSlug: f.frameworkSlug,
            status: f.status,
            note: f.note,
            details: (f.details as Record<string, string> | null) ?? {},
            validFrom: f.validFrom,
            validUntil: f.validUntil,
            documentIds: f.documents.map((d) => d.documentId),
          }))}
          documents={draft.documents.map((d) => ({ id: d.id, title: d.title, category: d.category, visibility: d.visibility }))}
        />
      </WizardShell>
    );
  }

  if (step === 4) {
    return (
      <WizardShell step={4}>
        <PeopleStep contacts={draft.contacts} certifications={draft.certifications} />
      </WizardShell>
    );
  }

  if (step === 5) {
    const integrations = await prisma.integration.findMany({ select: { provider: true } });
    return (
      <WizardShell step={5}>
        <DocumentsStep
          documents={draft.documents}
          integrations={{
            google: integrations.some((i) => i.provider === "GOOGLE_DRIVE"),
            microsoft: integrations.some((i) => i.provider === "ONEDRIVE"),
          }}
        />
      </WizardShell>
    );
  }

  const [published, unpublishedChanges] = await Promise.all([getPublished(), hasUnpublishedChanges()]);
  return (
    <WizardShell step={6} wide showPreview={false}>
      <PublishStep
        publicUrl={env().APP_URL}
        published={published ? { version: published.version, publishedAt: published.publishedAt } : null}
        hasUnpublishedChanges={unpublishedChanges}
        review={{
          companyName: draft.companyName,
          hasLogo: Boolean(draft.logoKey),
          frameworks: draft.frameworks.map((f) => ({ slug: f.frameworkSlug, status: f.status })),
          subprocessors: draft.subprocessors.map((s) => ({ name: s.name, hasLocations: s.locations.length > 0 })),
          documents: draft.documents.map((d) => ({ title: d.title, visibility: d.visibility })),
          contacts: draft.contacts.map((c) => ({ name: c.name, isPublished: c.isPublished })),
          certifications: draft.certifications.map((c) => ({ name: c.name, isPublished: c.isPublished, expiresAt: c.expiresAt })),
        }}
      />
    </WizardShell>
  );
}
