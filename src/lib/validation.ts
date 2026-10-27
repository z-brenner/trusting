import { z } from "zod";
import { isValidLocation } from "@/data/locations";
import { DATA_CATEGORIES } from "@/data/data-categories";
import { frameworkBySlug } from "@/data/frameworks";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must start with http:// or https://");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a #rrggbb colour");
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid date")
  .transform((v) => (v ? new Date(v) : null));

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(256)
  .refine((p) => !/^(.)\1+$/.test(p), "Choose a less predictable password");

export const setupSchema = z.object({
  name: trimmed(120).min(1, "Enter your name"),
  email: emailSchema,
  password: passwordSchema,
  companyName: trimmed(200).min(1, "Enter your company name"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
});

export const companySchema = z.object({
  companyName: trimmed(200),
  legalName: trimmed(200),
  title: trimmed(200),
  tagline: trimmed(300),
  description: trimmed(5000),
  websiteUrl: optionalUrl,
  primaryColor: hexColor,
  secondaryColor: hexColor,
  address: trimmed(500),
  registrationNumber: trimmed(100),
  industry: trimmed(100),
  contactEmail: z.union([z.literal(""), emailSchema]),
  contactPhone: trimmed(50),
  contactNote: trimmed(1000),
  showMap: z.boolean(),
});
export type CompanyInput = z.infer<typeof companySchema>;

export const subprocessorSchema = z.object({
  vendorSlug: z.string().trim().max(100).nullable().optional(),
  name: trimmed(200).min(1, "Enter the vendor name"),
  websiteUrl: optionalUrl,
  privacyPolicyUrl: optionalUrl,
  services: trimmed(1000),
  locations: z.array(z.string().trim().max(10)).max(100).refine((arr) => arr.every(isValidLocation), "Unknown location"),
  dataCategories: z
    .array(z.string())
    .max(50)
    .refine((arr) => arr.every((c) => DATA_CATEGORIES.some((d) => d.code === c)), "Unknown data category"),
  notes: trimmed(2000),
});
export type SubprocessorInput = z.infer<typeof subprocessorSchema>;

export const frameworkEntrySchema = z
  .object({
    frameworkSlug: z.string().trim().max(100),
    status: z.enum(["CERTIFIED", "AUDITED", "SELF_ATTESTED", "IN_PROGRESS", "APPLICABLE"]),
    note: trimmed(2000),
    details: z.record(z.string(), z.string().trim().max(500)).optional().default({}),
    validFrom: optionalDate.optional(),
    validUntil: optionalDate.optional(),
    documentIds: z.array(z.string().max(64)).max(50).optional().default([]),
  })
  .superRefine((val, ctx) => {
    const def = frameworkBySlug(val.frameworkSlug);
    if (!def) {
      ctx.addIssue({ code: "custom", path: ["frameworkSlug"], message: "Unknown framework" });
      return;
    }
    if (!def.allowedStatuses.includes(val.status)) {
      ctx.addIssue({ code: "custom", path: ["status"], message: `${def.shortName} cannot have the status "${val.status}"` });
    }
  });
export type FrameworkEntryInput = z.infer<typeof frameworkEntrySchema>;

export const contactSchema = z.object({
  name: trimmed(120).min(1, "Enter a name"),
  jobTitle: trimmed(120),
  department: trimmed(120),
  email: z.union([z.literal(""), emailSchema]),
  phone: trimmed(50),
  responsibilities: trimmed(1000),
  publishEmail: z.boolean(),
  publishPhone: z.boolean(),
  isPublished: z.boolean(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const certificationSchema = z.object({
  name: trimmed(200).min(1, "Enter the certification name"),
  issuer: trimmed(200),
  holderId: z.string().max(64).nullable().optional(),
  holderName: trimmed(120),
  issuedAt: optionalDate,
  expiresAt: optionalDate,
  credentialId: trimmed(120),
  verificationUrl: optionalUrl,
  isPublished: z.boolean(),
});
export type CertificationInput = z.infer<typeof certificationSchema>;

export const documentMetaSchema = z.object({
  title: trimmed(200).min(1, "Enter a title"),
  description: trimmed(2000),
  category: z.enum([
    "PRIVACY_POLICY",
    "SECURITY_POLICY",
    "DATA_PROCESSING_AGREEMENT",
    "PENETRATION_TEST",
    "AUDIT_REPORT",
    "COMPLIANCE_CERTIFICATE",
    "INCIDENT_RESPONSE",
    "BUSINESS_CONTINUITY",
    "OTHER",
  ]),
  visibility: z.enum(["PUBLIC", "REQUEST", "PRIVATE"]),
  allowDownload: z.boolean(),
  versionLabel: trimmed(100),
  documentDate: optionalDate,
});
export type DocumentMetaInput = z.infer<typeof documentMetaSchema>;

export const accessRequestSchema = z.object({
  requesterName: trimmed(120).min(1, "Enter your name"),
  requesterEmail: emailSchema,
  company: trimmed(200),
  message: trimmed(2000),
  documentIds: z.array(z.string().max(64)).min(1, "Select at least one document").max(50),
  // Honeypot: must stay empty.
  website: z.string().max(0).optional(),
});
export type AccessRequestInput = z.infer<typeof accessRequestSchema>;

/** Flatten zod issues to { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
