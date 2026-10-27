import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { TRUST_CENTER_ID } from "@/lib/trust-center";
import { AdminContainer, PageHeader } from "@/components/admin/page-header";
import { DocumentManager } from "@/components/admin/documents/document-manager";

export default async function DocumentsPage() {
  await requireAdmin();
  const [documents, integrations] = await Promise.all([
    prisma.document.findMany({
      where: { trustCenterId: TRUST_CENTER_ID },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      // Storage keys and content hashes stay on the server.
      omit: { storageKey: true, sha256: true },
    }),
    prisma.integration.findMany({ select: { provider: true } }),
  ]);
  const connected = {
    google: integrations.some((i) => i.provider === "GOOGLE_DRIVE"),
    microsoft: integrations.some((i) => i.provider === "ONEDRIVE"),
  };

  return (
    <AdminContainer>
      <PageHeader
        title="Documents"
        description="Policies, reports and certificates you share with visitors. Nothing is visible until you choose a visibility and publish."
      />
      <DocumentManager documents={documents} integrations={connected} variant="page" maxUploadMb={env().MAX_UPLOAD_MB} />
    </AdminContainer>
  );
}
