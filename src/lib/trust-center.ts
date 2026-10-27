import { prisma } from "./db";

export const TRUST_CENTER_ID = "default";

/** The single draft Trust Center for this installation (created on first access). */
export async function getDraft() {
  return prisma.trustCenter.upsert({
    where: { id: TRUST_CENTER_ID },
    update: {},
    create: { id: TRUST_CENTER_ID },
  });
}

export async function getDraftWithRelations() {
  await getDraft();
  return prisma.trustCenter.findUniqueOrThrow({
    where: { id: TRUST_CENTER_ID },
    include: {
      subprocessors: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      frameworks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { documents: true } },
      contacts: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      certifications: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { holder: true } },
      documents: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] },
      currentPublication: { select: { id: true, version: true, publishedAt: true } },
    },
  });
}

export type DraftWithRelations = Awaited<ReturnType<typeof getDraftWithRelations>>;
