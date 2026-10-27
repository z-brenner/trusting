"use client";

import type { Document } from "@/generated/prisma/client";
import { Alert } from "@/components/ui/card";
import { DocumentManager } from "@/components/admin/documents/document-manager";
import { StepFooter } from "./step-footer";

export function DocumentsStep({ documents, integrations }: { documents: Document[]; integrations: { google: boolean; microsoft: boolean } }) {
  return (
    <div className="space-y-8">
      <Alert tone="info">
        Private documents are never published. “Request access” documents appear on the page, but visitors must ask and
        you approve each request.
      </Alert>
      <DocumentManager variant="wizard" documents={documents} integrations={integrations} />
      <StepFooter continueLabel="Continue to preview" />
    </div>
  );
}
