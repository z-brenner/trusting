import type { DocumentCategory, DocumentVisibility } from "@/generated/prisma/enums";

export const DOCUMENT_CATEGORIES: { value: DocumentCategory; label: string; description: string }[] = [
  { value: "PRIVACY_POLICY", label: "Privacy policy", description: "How personal data is collected and used" },
  { value: "SECURITY_POLICY", label: "Security policy", description: "Information security policies and standards" },
  { value: "DATA_PROCESSING_AGREEMENT", label: "Data processing agreement", description: "DPA and standard contractual clauses" },
  { value: "PENETRATION_TEST", label: "Penetration test report", description: "Third-party or internal penetration testing" },
  { value: "AUDIT_REPORT", label: "Audit report", description: "SOC 2, ISAE 3000/3402 and other audit reports" },
  { value: "COMPLIANCE_CERTIFICATE", label: "Compliance certificate", description: "ISO certificates and similar attestations" },
  { value: "INCIDENT_RESPONSE", label: "Incident response policy", description: "How security incidents are handled" },
  { value: "BUSINESS_CONTINUITY", label: "Business continuity", description: "Continuity and disaster recovery documentation" },
  { value: "OTHER", label: "Other evidence", description: "Any other supporting documentation" },
];

export function documentCategoryLabel(value: DocumentCategory) {
  return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const VISIBILITY_OPTIONS: { value: DocumentVisibility; label: string; description: string }[] = [
  { value: "PUBLIC", label: "Public", description: "Anyone visiting the Trust Center can open it" },
  { value: "REQUEST", label: "Request access", description: "Visitors must request access; you approve each request" },
  { value: "PRIVATE", label: "Private", description: "Only administrators can see it" },
];

export function visibilityLabel(value: DocumentVisibility) {
  return VISIBILITY_OPTIONS.find((v) => v.value === value)?.label ?? value;
}

/** Allowed upload types, verified by magic bytes where possible. */
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
  "application/msword": ["doc"],
  "application/vnd.ms-excel": ["xls"],
  "application/vnd.ms-powerpoint": ["ppt"],
  "application/vnd.oasis.opendocument.text": ["odt"],
  "application/vnd.oasis.opendocument.spreadsheet": ["ods"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/svg+xml": ["svg"],
  "text/plain": ["txt"],
  "text/markdown": ["md"],
  "text/csv": ["csv"],
  "application/zip": ["zip"],
};

export const ALLOWED_LOGO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
