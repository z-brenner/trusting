import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildSnapshot, getPublished, publish, unpublish, hasUnpublishedChanges } from "@/lib/snapshot";
import { effectiveVisibility, mostRestrictive } from "@/lib/documents/access";
import { TRUST_CENTER_ID } from "@/lib/trust-center";

async function reset() {
  await prisma.auditLog.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.document.deleteMany();
  await prisma.certification.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.frameworkEntry.deleteMany();
  await prisma.subprocessor.deleteMany();
  await prisma.trustCenter.deleteMany();
  await prisma.publication.deleteMany();
}

beforeAll(reset);

describe("draft vs published", () => {
  it("snapshots exclude private documents and unpublished contact details", async () => {
    await prisma.trustCenter.create({ data: { id: TRUST_CENTER_ID, companyName: "Acme", primaryColor: "#112233" } });
    await prisma.document.createMany({
      data: [
        { title: "Public policy", storageKey: "documents/aa/1.pdf", fileName: "p.pdf", mimeType: "application/pdf", sizeBytes: 1, sha256: "x", visibility: "PUBLIC" },
        { title: "Gated report", storageKey: "documents/aa/2.pdf", fileName: "g.pdf", mimeType: "application/pdf", sizeBytes: 1, sha256: "y", visibility: "REQUEST" },
        { title: "Secret", storageKey: "documents/aa/3.pdf", fileName: "s.pdf", mimeType: "application/pdf", sizeBytes: 1, sha256: "z", visibility: "PRIVATE" },
      ],
    });
    await prisma.contact.create({ data: { name: "Sam", email: "sam@acme.test", phone: "123", publishEmail: true, publishPhone: false } });
    await prisma.contact.create({ data: { name: "Hidden", isPublished: false } });
    const snap = await buildSnapshot();
    expect(snap.company.title).toBe("Acme Trust Center");
    expect(snap.documents.map((d) => d.title).sort()).toEqual(["Gated report", "Public policy"]);
    expect(snap.contacts).toHaveLength(1);
    expect(snap.contacts[0]).toMatchObject({ email: "sam@acme.test", phone: null });
  });

  it("publishes a frozen version and keeps later draft edits private", async () => {
    expect(await getPublished()).toBeNull();
    const pub = await publish(null);
    expect(pub.version).toBe(1);
    const published = await getPublished();
    expect(published?.snapshot.company.companyName).toBe("Acme");
    expect(await hasUnpublishedChanges()).toBe(false);

    await prisma.trustCenter.update({ where: { id: TRUST_CENTER_ID }, data: { companyName: "Acme Renamed" } });
    expect((await getPublished())?.snapshot.company.companyName).toBe("Acme");
    expect(await hasUnpublishedChanges()).toBe(true);

    const pub2 = await publish(null);
    expect(pub2.version).toBe(2);
    expect((await getPublished())?.snapshot.company.companyName).toBe("Acme Renamed");

    await unpublish();
    expect(await getPublished()).toBeNull();
    expect(await prisma.publication.count()).toBe(2);
  });

  it("effective visibility is the most restrictive of draft and snapshot", async () => {
    await publish(null);
    const pub = await prisma.document.findFirstOrThrow({ where: { title: "Public policy" } });
    const gated = await prisma.document.findFirstOrThrow({ where: { title: "Gated report" } });
    const secret = await prisma.document.findFirstOrThrow({ where: { title: "Secret" } });
    expect(await effectiveVisibility(pub.id)).toBe("PUBLIC");
    expect(await effectiveVisibility(gated.id)).toBe("REQUEST");
    expect(await effectiveVisibility(secret.id)).toBe("PRIVATE");

    // Tightening in the draft takes effect immediately...
    await prisma.document.update({ where: { id: pub.id }, data: { visibility: "PRIVATE" } });
    expect(await effectiveVisibility(pub.id)).toBe("PRIVATE");
    // ...loosening does not until published.
    await prisma.document.update({ where: { id: secret.id }, data: { visibility: "PUBLIC" } });
    expect(await effectiveVisibility(secret.id)).toBe("PRIVATE");
    await publish(null);
    expect(await effectiveVisibility(secret.id)).toBe("PUBLIC");
    expect(await effectiveVisibility("does-not-exist")).toBeNull();
    expect(mostRestrictive("PUBLIC", "REQUEST")).toBe("REQUEST");
  });
});
