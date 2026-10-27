import type { DocumentCategory, DocumentVisibility, FrameworkStatus } from "@/generated/prisma/enums";
import { prisma } from "./db";
import { getDraftWithRelations, TRUST_CENTER_ID } from "./trust-center";
import { frameworkBySlug } from "@/data/frameworks";

/**
 * A Publication stores an immutable JSON snapshot of everything the public page
 * needs. Rendering from the snapshot (not the live draft) is what keeps
 * unfinished edits private until the administrator publishes again.
 */
export const SNAPSHOT_VERSION = 1;

export type SnapshotCompany = {
  companyName: string;
  legalName: string;
  title: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  hasLogo: boolean;
  primaryColor: string;
  secondaryColor: string;
  address: string;
  registrationNumber: string;
  industry: string;
  contactEmail: string;
  contactPhone: string;
  contactNote: string;
  showMap: boolean;
};

export type SnapshotSubprocessor = {
  id: string;
  vendorSlug: string | null;
  name: string;
  websiteUrl: string;
  privacyPolicyUrl: string;
  services: string;
  locations: string[];
  dataCategories: string[];
  notes: string;
};

export type SnapshotFramework = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  kind: string;
  status: FrameworkStatus;
  note: string;
  details: Record<string, string> | null;
  validFrom: string | null;
  validUntil: string | null;
  documentIds: string[];
};

export type SnapshotContact = {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  email: string | null;
  phone: string | null;
  responsibilities: string;
};

export type SnapshotCertification = {
  id: string;
  name: string;
  issuer: string;
  holderName: string;
  issuedAt: string | null;
  expiresAt: string | null;
  credentialId: string;
  verificationUrl: string;
};

export type SnapshotDocument = {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  visibility: Exclude<DocumentVisibility, "PRIVATE">;
  allowDownload: boolean;
  versionLabel: string;
  documentDate: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
};

export type Snapshot = {
  snapshotVersion: number;
  company: SnapshotCompany;
  subprocessors: SnapshotSubprocessor[];
  frameworks: SnapshotFramework[];
  contacts: SnapshotContact[];
  certifications: SnapshotCertification[];
  documents: SnapshotDocument[];
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/** Build a snapshot from the current draft. Private documents and unpublished people are excluded. */
export async function buildSnapshot(): Promise<Snapshot> {
  const d = await getDraftWithRelations();
  const publishedDocs = d.documents.filter((doc) => doc.visibility !== "PRIVATE");
  const publishedDocIds = new Set(publishedDocs.map((doc) => doc.id));

  return {
    snapshotVersion: SNAPSHOT_VERSION,
    company: {
      companyName: d.companyName,
      legalName: d.legalName,
      title: d.title || (d.companyName ? `${d.companyName} Trust Center` : "Trust Center"),
      tagline: d.tagline,
      description: d.description,
      websiteUrl: d.websiteUrl,
      hasLogo: Boolean(d.logoKey),
      primaryColor: d.primaryColor,
      secondaryColor: d.secondaryColor,
      address: d.address,
      registrationNumber: d.registrationNumber,
      industry: d.industry,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone,
      contactNote: d.contactNote,
      showMap: d.showMap,
    },
    subprocessors: d.subprocessors.map((s) => ({
      id: s.id,
      vendorSlug: s.vendorSlug,
      name: s.name,
      websiteUrl: s.websiteUrl,
      privacyPolicyUrl: s.privacyPolicyUrl,
      services: s.services,
      locations: s.locations,
      dataCategories: s.dataCategories,
      notes: s.notes,
    })),
    frameworks: d.frameworks.map((f) => {
      const def = frameworkBySlug(f.frameworkSlug);
      return {
        id: f.id,
        slug: f.frameworkSlug,
        name: def?.name ?? f.frameworkSlug,
        shortName: def?.shortName ?? f.frameworkSlug,
        kind: def?.kind ?? "framework",
        status: f.status,
        note: f.note,
        details: (f.details as Record<string, string> | null) ?? null,
        validFrom: iso(f.validFrom),
        validUntil: iso(f.validUntil),
        documentIds: f.documents.map((x) => x.documentId).filter((id) => publishedDocIds.has(id)),
      };
    }),
    contacts: d.contacts
      .filter((c) => c.isPublished)
      .map((c) => ({
        id: c.id,
        name: c.name,
        jobTitle: c.jobTitle,
        department: c.department,
        email: c.publishEmail && c.email ? c.email : null,
        phone: c.publishPhone && c.phone ? c.phone : null,
        responsibilities: c.responsibilities,
      })),
    certifications: d.certifications
      .filter((c) => c.isPublished)
      .map((c) => ({
        id: c.id,
        name: c.name,
        issuer: c.issuer,
        holderName: c.holder?.isPublished ? c.holder.name : c.holderName,
        issuedAt: iso(c.issuedAt),
        expiresAt: iso(c.expiresAt),
        credentialId: c.credentialId,
        verificationUrl: c.verificationUrl,
      })),
    documents: publishedDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      visibility: doc.visibility as "PUBLIC" | "REQUEST",
      allowDownload: doc.allowDownload,
      versionLabel: doc.versionLabel,
      documentDate: iso(doc.documentDate),
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      updatedAt: doc.updatedAt.toISOString(),
    })),
  };
}

export type PublishedTrustCenter = {
  publicationId: string;
  version: number;
  publishedAt: Date;
  snapshot: Snapshot;
};

/** The currently published Trust Center, or null when unpublished. */
export async function getPublished(): Promise<PublishedTrustCenter | null> {
  const tc = await prisma.trustCenter.findUnique({
    where: { id: TRUST_CENTER_ID },
    include: { currentPublication: true },
  });
  const pub = tc?.currentPublication;
  if (!pub) return null;
  return {
    publicationId: pub.id,
    version: pub.version,
    publishedAt: pub.publishedAt,
    snapshot: pub.snapshot as unknown as Snapshot,
  };
}

/** Create a new publication from the current draft and make it current. */
export async function publish(userId: string | null, note = "") {
  const snapshot = await buildSnapshot();
  const last = await prisma.publication.findFirst({
    where: { trustCenterId: TRUST_CENTER_ID },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  return prisma.$transaction(async (tx) => {
    const pub = await tx.publication.create({
      data: {
        trustCenterId: TRUST_CENTER_ID,
        version,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
        publishedById: userId,
        note,
      },
    });
    await tx.trustCenter.update({ where: { id: TRUST_CENTER_ID }, data: { currentPublicationId: pub.id } });
    return pub;
  });
}

export async function unpublish() {
  await prisma.trustCenter.update({ where: { id: TRUST_CENTER_ID }, data: { currentPublicationId: null } });
}

/**
 * Whether the draft differs from what is published. Cheap heuristic based on
 * serialised snapshots; good enough to show an "unpublished changes" hint.
 */
export async function hasUnpublishedChanges(): Promise<boolean> {
  const published = await getPublished();
  if (!published) return false;
  const current = await buildSnapshot();
  return JSON.stringify(current) !== JSON.stringify(published.snapshot);
}
