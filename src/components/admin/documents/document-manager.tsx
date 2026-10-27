"use client";

/**
 * STUB — replaced by the admin documents implementation.
 * Contract: a self-contained client component that lists documents, supports upload
 * (multipart POST to /api/uploads/documents), editing metadata (title, description,
 * category, visibility, allowDownload, versionLabel, documentDate), deletion, and an
 * "Import from Google Drive / OneDrive" entry point that renders <DrivePicker/> from
 * "@/components/admin/integrations/drive-picker" when the respective integration is connected.
 * Used both on /admin/documents and in wizard step 5.
 */
import type { Document } from "@/generated/prisma/client";

export type DocumentManagerProps = {
  documents: Document[];
  integrations: { google: boolean; microsoft: boolean };
  /** "wizard" hides the page header and keeps the layout compact. */
  variant?: "page" | "wizard";
};

export function DocumentManager({ documents }: DocumentManagerProps) {
  return <div>{documents.length} documents</div>;
}
