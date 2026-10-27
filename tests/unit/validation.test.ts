import { describe, expect, it } from "vitest";
import { frameworkEntrySchema, subprocessorSchema, accessRequestSchema, companySchema, passwordSchema } from "@/lib/validation";
import { FRAMEWORKS } from "@/data/frameworks";
import { expandLocationToCountries, isValidLocation, locationName } from "@/data/locations";

describe("framework status rules", () => {
  it("does not allow legislation to be 'certified'", () => {
    const res = frameworkEntrySchema.safeParse({ frameworkSlug: "gdpr", status: "CERTIFIED", note: "" });
    expect(res.success).toBe(false);
    expect(res.success ? "" : res.error.issues[0].message).toMatch(/cannot have the status/);
  });
  it("allows certifiable standards to be certified and regulations to be applicable", () => {
    expect(frameworkEntrySchema.safeParse({ frameworkSlug: "iso-27001", status: "CERTIFIED", note: "" }).success).toBe(true);
    expect(frameworkEntrySchema.safeParse({ frameworkSlug: "gdpr", status: "APPLICABLE", note: "" }).success).toBe(true);
    expect(frameworkEntrySchema.safeParse({ frameworkSlug: "soc-2", status: "CERTIFIED", note: "" }).success).toBe(false);
  });
  it("rejects unknown frameworks", () => {
    expect(frameworkEntrySchema.safeParse({ frameworkSlug: "nope", status: "APPLICABLE", note: "" }).success).toBe(false);
  });
  it("every catalog entry has at least one allowed status and an official URL", () => {
    for (const f of FRAMEWORKS) {
      expect(f.allowedStatuses.length).toBeGreaterThan(0);
      expect(f.officialUrl).toMatch(/^https:\/\//);
      if (f.kind === "regulation") expect(f.allowedStatuses).not.toContain("CERTIFIED");
    }
  });
});

describe("subprocessor validation", () => {
  it("accepts region and country codes and rejects unknown ones", () => {
    const base = { name: "AWS", websiteUrl: "", privacyPolicyUrl: "", services: "", dataCategories: [], notes: "" };
    expect(subprocessorSchema.safeParse({ ...base, locations: ["EU", "US", "DE"] }).success).toBe(true);
    expect(subprocessorSchema.safeParse({ ...base, locations: ["MARS"] }).success).toBe(false);
    expect(subprocessorSchema.safeParse({ ...base, locations: [], websiteUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("locations", () => {
  it("expands EU/EEA to member countries", () => {
    expect(expandLocationToCountries("EU")).toHaveLength(27);
    expect(expandLocationToCountries("EEA")).toHaveLength(30);
    expect(expandLocationToCountries("GLOBAL")).toEqual([]);
    expect(expandLocationToCountries("DE")).toEqual(["DE"]);
    expect(isValidLocation("XX")).toBe(false);
    expect(locationName("IE")).toBe("Ireland");
  });
});

describe("access requests", () => {
  it("requires at least one document and a valid email", () => {
    expect(accessRequestSchema.safeParse({ requesterName: "A", requesterEmail: "nope", company: "", message: "", documentIds: ["x"] }).success).toBe(false);
    expect(accessRequestSchema.safeParse({ requesterName: "A", requesterEmail: "a@b.co", company: "", message: "", documentIds: [] }).success).toBe(false);
    expect(accessRequestSchema.safeParse({ requesterName: "A", requesterEmail: "A@B.CO", company: "", message: "", documentIds: ["x"] }).success).toBe(true);
  });
});

describe("company + passwords", () => {
  it("validates colours and urls", () => {
    const base = { companyName: "x", legalName: "", title: "", tagline: "", description: "", websiteUrl: "", primaryColor: "#123456", secondaryColor: "#abcdef", address: "", registrationNumber: "", industry: "", contactEmail: "", contactPhone: "", contactNote: "", showMap: true };
    expect(companySchema.safeParse(base).success).toBe(true);
    expect(companySchema.safeParse({ ...base, primaryColor: "red" }).success).toBe(false);
    expect(companySchema.safeParse({ ...base, websiteUrl: "ftp://x" }).success).toBe(false);
  });
  it("rejects short and repetitive passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("aaaaaaaaaaaaaaaa").success).toBe(false);
    expect(passwordSchema.safeParse("correct horse battery").success).toBe(true);
  });
});
