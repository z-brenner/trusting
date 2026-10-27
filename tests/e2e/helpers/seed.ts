import { db } from "./db";
import { publish } from "../../../src/lib/snapshot";
import { MINIMAL_PDF } from "./fixtures";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Seeds a realistic draft directly in the database (bypassing the UI) and
 * publishes it. Files are written to the e2e local storage folder so that
 * downloads stream real bytes.
 */
export async function seedTrustCenter() {
  const prisma = db();
  await prisma.trustCenter.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  await prisma.trustCenter.update({
    where: { id: "default" },
    data: {
      companyName: "Acme Analytics",
      legalName: "Acme Analytics GmbH",
      title: "Acme Analytics Trust Center",
      tagline: "How we protect customer data.",
      description: "We build analytics software.\n\nSecurity is part of how we work.",
      websiteUrl: "https://acme-analytics.example",
      primaryColor: "#1f3a5f",
      secondaryColor: "#0f766e",
      contactEmail: "security@acme-analytics.example",
      showMap: true,
    },
  });
  await prisma.subprocessor.deleteMany();
  await prisma.subprocessor.createMany({
    data: [
      { vendorSlug: "aws", name: "Amazon Web Services (AWS)", websiteUrl: "https://aws.amazon.com", privacyPolicyUrl: "https://aws.amazon.com/privacy/", services: "Cloud hosting", locations: ["IE", "DE"], dataCategories: ["account", "content"] },
      { vendorSlug: "stripe", name: "Stripe", websiteUrl: "https://stripe.com", privacyPolicyUrl: "https://stripe.com/privacy", services: "Payments", locations: ["US"], dataCategories: ["payment"] },
      { name: "Hetzner", services: "Backups", locations: ["EU"], dataCategories: ["content"] },
      { name: "Cloudflare", services: "CDN", locations: ["GLOBAL"], dataCategories: ["device"] },
    ],
  });
  await prisma.frameworkEntry.deleteMany();
  await prisma.frameworkEntry.createMany({
    data: [
      { frameworkSlug: "iso-27001", status: "CERTIFIED", note: "Certified since 2023", details: { version: "2022" } },
      { frameworkSlug: "gdpr", status: "APPLICABLE", note: "" },
      { frameworkSlug: "soc-2", status: "IN_PROGRESS", note: "Type II audit scheduled", details: { type: "2" } },
      { frameworkSlug: "cis-controls-v8", status: "SELF_ATTESTED", note: "", details: { implementationGroup: "IG2" } },
    ],
  });
  await prisma.certification.deleteMany();
  await prisma.contact.deleteMany();
  const cto = await prisma.contact.create({ data: { name: "Dr. Anna Weber", jobTitle: "CISO", department: "Security", email: "anna@acme-analytics.example", phone: "+49 30 1234", responsibilities: "Security programme", publishEmail: true, publishPhone: false } });
  await prisma.contact.create({ data: { name: "Hidden Person", jobTitle: "Ops", isPublished: false } });
  await prisma.certification.create({ data: { name: "CISSP", issuer: "ISC2", holderId: cto.id, issuedAt: new Date("2022-04-01"), expiresAt: new Date("2028-04-01"), credentialId: "123456", verificationUrl: "https://www.isc2.org/" } });

  await prisma.accessRequest.deleteMany();
  await prisma.document.deleteMany();
  const storageRoot = path.resolve("storage-e2e");
  const docs = [
    { title: "Privacy Policy", category: "PRIVACY_POLICY", visibility: "PUBLIC", key: "documents/aa/privacy.pdf" },
    { title: "Penetration Test Summary", category: "PENETRATION_TEST", visibility: "REQUEST", key: "documents/aa/pentest.pdf" },
    { title: "SOC 2 Report", category: "AUDIT_REPORT", visibility: "REQUEST", key: "documents/aa/soc2.pdf" },
    { title: "Internal Runbook", category: "OTHER", visibility: "PRIVATE", key: "documents/aa/runbook.pdf" },
  ] as const;
  const created: Record<string, string> = {};
  for (const d of docs) {
    const full = path.join(storageRoot, d.key);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, MINIMAL_PDF);
    const row = await prisma.document.create({
      data: {
        title: d.title,
        category: d.category,
        visibility: d.visibility,
        storageKey: d.key,
        fileName: `${d.title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: MINIMAL_PDF.length,
        sha256: createHash("sha256").update(MINIMAL_PDF).digest("hex"),
        documentDate: new Date("2026-01-15"),
      },
    });
    created[d.title] = row.id;
  }
  const pub = await publishWithE2EDb();
  return { documents: created, version: pub.version };
}

/** publish() from the app reads env DATABASE_URL; the e2e env already points it at the e2e DB. */
async function publishWithE2EDb() {
  return publish(null);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
