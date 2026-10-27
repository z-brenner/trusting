import type { FrameworkStatus } from "@/generated/prisma/enums";

/**
 * Framework directory. `kind` drives which statuses make sense:
 *  - regulation:  laws such as GDPR; you cannot be "certified", only aligned/applicable
 *  - standard:    certifiable standards such as ISO 27001
 *  - attestation: audit/assurance reports such as SOC 2, ISAE 3000/3402
 *  - framework:   voluntary control frameworks such as NIST CSF or CIS Controls
 */
export type FrameworkKind = "regulation" | "standard" | "attestation" | "framework";

export type FrameworkOption = { value: string; label: string };

export type Framework = {
  slug: string;
  name: string;
  shortName: string;
  kind: FrameworkKind;
  region: string;
  description: string;
  officialUrl: string;
  allowedStatuses: FrameworkStatus[];
  /** Optional structured details the administrator can fill in (e.g. CIS implementation group). */
  detailFields?: { key: string; label: string; type: "select" | "text"; options?: FrameworkOption[]; help?: string }[];
};

export const FRAMEWORK_STATUS_LABELS: Record<FrameworkStatus, { label: string; description: string }> = {
  CERTIFIED: { label: "Certified", description: "A certificate was issued by an accredited certification body." },
  AUDITED: { label: "Independently audited", description: "An independent auditor or assessor has issued a report or assessment." },
  SELF_ATTESTED: { label: "Self-attested alignment", description: "We align our practices with this framework; no external verification." },
  IN_PROGRESS: { label: "Implementation in progress", description: "We are actively working towards this." },
  APPLICABLE: { label: "Applicable", description: "This law or regulation applies to us and we comply with its requirements." },
};

const CERTIFIABLE: FrameworkStatus[] = ["CERTIFIED", "AUDITED", "SELF_ATTESTED", "IN_PROGRESS"];
const ATTESTABLE: FrameworkStatus[] = ["AUDITED", "IN_PROGRESS"];
const REGULATORY: FrameworkStatus[] = ["APPLICABLE", "AUDITED", "SELF_ATTESTED", "IN_PROGRESS"];
const VOLUNTARY: FrameworkStatus[] = ["AUDITED", "SELF_ATTESTED", "IN_PROGRESS"];

export const FRAMEWORKS: Framework[] = [
  {
    slug: "gdpr",
    name: "General Data Protection Regulation",
    shortName: "GDPR",
    kind: "regulation",
    region: "European Union",
    description: "EU regulation on the processing of personal data. Legislation, not a certification: organisations comply, they are not certified.",
    officialUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    allowedStatuses: REGULATORY,
  },
  {
    slug: "nis2",
    name: "NIS2 Directive",
    shortName: "NIS2",
    kind: "regulation",
    region: "European Union",
    description: "EU directive on measures for a high common level of cybersecurity, transposed into national law by member states.",
    officialUrl: "https://eur-lex.europa.eu/eli/dir/2022/2555/oj",
    allowedStatuses: REGULATORY,
  },
  {
    slug: "iso-27001",
    name: "ISO/IEC 27001 Information Security Management",
    shortName: "ISO 27001",
    kind: "standard",
    region: "International",
    description: "The international standard for information security management systems (ISMS). Certifiable by accredited bodies.",
    officialUrl: "https://www.iso.org/standard/27001",
    allowedStatuses: CERTIFIABLE,
    detailFields: [
      { key: "version", label: "Edition", type: "select", options: [{ value: "2022", label: "ISO/IEC 27001:2022" }, { value: "2013", label: "ISO/IEC 27001:2013" }] },
      { key: "certificationBody", label: "Certification body", type: "text", help: "Only if certified." },
    ],
  },
  {
    slug: "iso-27701",
    name: "ISO/IEC 27701 Privacy Information Management",
    shortName: "ISO 27701",
    kind: "standard",
    region: "International",
    description: "Extension to ISO 27001 for privacy information management. Certifiable.",
    officialUrl: "https://www.iso.org/standard/71670.html",
    allowedStatuses: CERTIFIABLE,
    detailFields: [{ key: "certificationBody", label: "Certification body", type: "text", help: "Only if certified." }],
  },
  {
    slug: "eu-ai-act",
    name: "EU Artificial Intelligence Act",
    shortName: "EU AI Act",
    kind: "regulation",
    region: "European Union",
    description: "EU regulation laying down harmonised rules on artificial intelligence. Article 5 lists prohibited AI practices.",
    officialUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    allowedStatuses: REGULATORY,
    detailFields: [
      {
        key: "role",
        label: "Our role",
        type: "select",
        options: [
          { value: "provider", label: "Provider of AI systems" },
          { value: "deployer", label: "Deployer of AI systems" },
          { value: "both", label: "Provider and deployer" },
          { value: "none", label: "We do not place AI systems on the market" },
        ],
      },
      {
        key: "article5",
        label: "Article 5 (prohibited practices)",
        type: "select",
        options: [
          { value: "assessed-none", label: "Assessed: no prohibited practices used" },
          { value: "assessment-in-progress", label: "Assessment in progress" },
          { value: "not-assessed", label: "Not yet assessed" },
        ],
        help: "Article 5 bans practices such as social scoring and manipulative AI.",
      },
      {
        key: "riskLevel",
        label: "Highest risk classification of our AI systems",
        type: "select",
        options: [
          { value: "minimal", label: "Minimal risk" },
          { value: "limited", label: "Limited risk (transparency obligations)" },
          { value: "high", label: "High risk" },
          { value: "unknown", label: "Classification in progress" },
        ],
      },
    ],
  },
  {
    slug: "isae-3000",
    name: "ISAE 3000 Assurance Report",
    shortName: "ISAE 3000",
    kind: "attestation",
    region: "International",
    description: "Assurance engagements other than audits of historical financial information, often used for GDPR/data-protection assurance reports.",
    officialUrl: "https://www.iaasb.org/publications/international-standard-assurance-engagements-isae-3000-revised-assurance-engagements-other-audits-or",
    allowedStatuses: ATTESTABLE,
    detailFields: [
      { key: "type", label: "Report type", type: "select", options: [{ value: "1", label: "Type 1 (design at a point in time)" }, { value: "2", label: "Type 2 (operating effectiveness over a period)" }] },
      { key: "auditor", label: "Auditor", type: "text" },
    ],
  },
  {
    slug: "isae-3402",
    name: "ISAE 3402 Service Organisation Report",
    shortName: "ISAE 3402",
    kind: "attestation",
    region: "International",
    description: "Assurance report on controls at a service organisation relevant to user entities' financial reporting.",
    officialUrl: "https://www.iaasb.org/publications/international-standard-assurance-engagements-isae-3402-assurance-reports-controls-service-organization",
    allowedStatuses: ATTESTABLE,
    detailFields: [
      { key: "type", label: "Report type", type: "select", options: [{ value: "1", label: "Type 1" }, { value: "2", label: "Type 2" }] },
      { key: "auditor", label: "Auditor", type: "text" },
    ],
  },
  {
    slug: "soc-2",
    name: "SOC 2",
    shortName: "SOC 2",
    kind: "attestation",
    region: "United States / International",
    description: "AICPA attestation report on controls relevant to security, availability, processing integrity, confidentiality and privacy.",
    officialUrl: "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2",
    allowedStatuses: ATTESTABLE,
    detailFields: [
      { key: "type", label: "Report type", type: "select", options: [{ value: "1", label: "Type I" }, { value: "2", label: "Type II" }] },
      { key: "criteria", label: "Trust services criteria in scope", type: "text", help: "e.g. Security, Availability, Confidentiality" },
      { key: "auditor", label: "Auditor", type: "text" },
    ],
  },
  {
    slug: "dora",
    name: "Digital Operational Resilience Act",
    shortName: "DORA",
    kind: "regulation",
    region: "European Union",
    description: "EU regulation on digital operational resilience for the financial sector and its ICT third-party providers.",
    officialUrl: "https://eur-lex.europa.eu/eli/reg/2022/2554/oj",
    allowedStatuses: REGULATORY,
    detailFields: [
      {
        key: "role",
        label: "Our role",
        type: "select",
        options: [
          { value: "financial-entity", label: "Financial entity" },
          { value: "ict-provider", label: "ICT third-party service provider" },
          { value: "both", label: "Both" },
        ],
      },
    ],
  },
  {
    slug: "cis-controls-v8",
    name: "CIS Critical Security Controls v8",
    shortName: "CIS Controls v8",
    kind: "framework",
    region: "International",
    description: "Prioritised set of safeguards from the Center for Internet Security, organised in Implementation Groups IG1–IG3.",
    officialUrl: "https://www.cisecurity.org/controls/v8",
    allowedStatuses: VOLUNTARY,
    detailFields: [
      {
        key: "implementationGroup",
        label: "Implementation Group",
        type: "select",
        options: [
          { value: "IG1", label: "IG1 – essential cyber hygiene" },
          { value: "IG2", label: "IG2" },
          { value: "IG3", label: "IG3" },
        ],
      },
    ],
  },
  {
    slug: "nist-csf",
    name: "NIST Cybersecurity Framework",
    shortName: "NIST CSF",
    kind: "framework",
    region: "United States / International",
    description: "Voluntary framework of standards, guidelines and practices for managing cybersecurity risk.",
    officialUrl: "https://www.nist.gov/cyberframework",
    allowedStatuses: VOLUNTARY,
    detailFields: [
      { key: "version", label: "Version", type: "select", options: [{ value: "2.0", label: "CSF 2.0" }, { value: "1.1", label: "CSF 1.1" }] },
      {
        key: "tier",
        label: "Implementation tier (self-assessed)",
        type: "select",
        options: [
          { value: "1", label: "Tier 1 – Partial" },
          { value: "2", label: "Tier 2 – Risk informed" },
          { value: "3", label: "Tier 3 – Repeatable" },
          { value: "4", label: "Tier 4 – Adaptive" },
        ],
      },
    ],
  },
  {
    slug: "hipaa",
    name: "Health Insurance Portability and Accountability Act",
    shortName: "HIPAA",
    kind: "regulation",
    region: "United States",
    description: "US law protecting health information. There is no official HIPAA certification; organisations comply and may obtain third-party assessments.",
    officialUrl: "https://www.hhs.gov/hipaa/index.html",
    allowedStatuses: REGULATORY,
    detailFields: [
      {
        key: "role",
        label: "Our role",
        type: "select",
        options: [
          { value: "covered-entity", label: "Covered entity" },
          { value: "business-associate", label: "Business associate" },
        ],
      },
    ],
  },
  {
    slug: "pci-dss",
    name: "Payment Card Industry Data Security Standard",
    shortName: "PCI DSS",
    kind: "standard",
    region: "International",
    description: "Security standard for organisations that handle branded payment cards, validated through SAQ or QSA assessment.",
    officialUrl: "https://www.pcisecuritystandards.org/",
    allowedStatuses: ["AUDITED", "SELF_ATTESTED", "IN_PROGRESS"],
    detailFields: [
      { key: "version", label: "Version", type: "select", options: [{ value: "4.0.1", label: "PCI DSS v4.0.1" }, { value: "4.0", label: "PCI DSS v4.0" }] },
      {
        key: "validation",
        label: "Validation type",
        type: "select",
        options: [
          { value: "saq", label: "Self-Assessment Questionnaire (SAQ)" },
          { value: "roc", label: "Report on Compliance by a QSA" },
        ],
      },
      { key: "level", label: "Merchant / service provider level", type: "text" },
    ],
  },
  {
    slug: "ccpa-cpra",
    name: "California Consumer Privacy Act / California Privacy Rights Act",
    shortName: "CCPA/CPRA",
    kind: "regulation",
    region: "United States (California)",
    description: "California privacy law granting consumers rights over their personal information. Legislation, not a certification.",
    officialUrl: "https://oag.ca.gov/privacy/ccpa",
    allowedStatuses: REGULATORY,
  },
  {
    slug: "uk-gdpr",
    name: "UK GDPR & Data Protection Act 2018",
    shortName: "UK GDPR",
    kind: "regulation",
    region: "United Kingdom",
    description: "The UK's retained version of the GDPR together with the Data Protection Act 2018.",
    officialUrl: "https://ico.org.uk/for-organisations/data-protection-and-the-eu/data-protection-and-the-eu-in-detail/the-uk-gdpr/",
    allowedStatuses: REGULATORY,
  },
  {
    slug: "cyber-essentials",
    name: "Cyber Essentials",
    shortName: "Cyber Essentials",
    kind: "standard",
    region: "United Kingdom",
    description: "UK government-backed scheme with self-assessed (Cyber Essentials) and independently verified (Cyber Essentials Plus) levels.",
    officialUrl: "https://www.ncsc.gov.uk/cyberessentials/overview",
    allowedStatuses: CERTIFIABLE,
    detailFields: [
      { key: "level", label: "Level", type: "select", options: [{ value: "ce", label: "Cyber Essentials" }, { value: "ce-plus", label: "Cyber Essentials Plus" }] },
    ],
  },
  {
    slug: "iso-9001",
    name: "ISO 9001 Quality Management",
    shortName: "ISO 9001",
    kind: "standard",
    region: "International",
    description: "International standard for quality management systems. Certifiable.",
    officialUrl: "https://www.iso.org/standard/62085.html",
    allowedStatuses: CERTIFIABLE,
  },
  {
    slug: "iso-22301",
    name: "ISO 22301 Business Continuity",
    shortName: "ISO 22301",
    kind: "standard",
    region: "International",
    description: "International standard for business continuity management systems. Certifiable.",
    officialUrl: "https://www.iso.org/standard/75106.html",
    allowedStatuses: CERTIFIABLE,
  },
  {
    slug: "iso-42001",
    name: "ISO/IEC 42001 AI Management",
    shortName: "ISO 42001",
    kind: "standard",
    region: "International",
    description: "International standard for artificial intelligence management systems. Certifiable.",
    officialUrl: "https://www.iso.org/standard/42001",
    allowedStatuses: CERTIFIABLE,
  },
  {
    slug: "soc-1",
    name: "SOC 1",
    shortName: "SOC 1",
    kind: "attestation",
    region: "United States / International",
    description: "AICPA attestation report on controls relevant to user entities' internal control over financial reporting.",
    officialUrl: "https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-1",
    allowedStatuses: ATTESTABLE,
    detailFields: [{ key: "type", label: "Report type", type: "select", options: [{ value: "1", label: "Type I" }, { value: "2", label: "Type II" }] }],
  },
  {
    slug: "csa-star",
    name: "CSA STAR",
    shortName: "CSA STAR",
    kind: "framework",
    region: "International",
    description: "Cloud Security Alliance registry with self-assessment (Level 1) and third-party certification/attestation (Level 2).",
    officialUrl: "https://cloudsecurityalliance.org/star",
    allowedStatuses: CERTIFIABLE,
    detailFields: [{ key: "level", label: "Level", type: "select", options: [{ value: "1", label: "Level 1 – Self-assessment" }, { value: "2", label: "Level 2 – Third-party" }] }],
  },
  {
    slug: "tisax",
    name: "TISAX",
    shortName: "TISAX",
    kind: "attestation",
    region: "Automotive industry (Europe)",
    description: "Assessment and exchange mechanism for information security in the automotive industry, operated by ENX.",
    officialUrl: "https://enx.com/en-US/TISAX/",
    allowedStatuses: ATTESTABLE,
  },
];

export const FRAMEWORK_KIND_LABELS: Record<FrameworkKind, string> = {
  regulation: "Law / regulation",
  standard: "Certifiable standard",
  attestation: "Audit / assurance report",
  framework: "Control framework",
};

const bySlug = new Map(FRAMEWORKS.map((f) => [f.slug, f]));

export function frameworkBySlug(slug: string) {
  return bySlug.get(slug);
}
