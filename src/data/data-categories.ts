/** Categories of personal data commonly disclosed in subprocessor lists. */
export const DATA_CATEGORIES = [
  { code: "contact", label: "Contact details", description: "Names, email addresses, phone numbers" },
  { code: "account", label: "Account data", description: "Usernames, IDs, authentication metadata" },
  { code: "usage", label: "Usage & analytics data", description: "Product usage, events, telemetry" },
  { code: "device", label: "Device & technical data", description: "IP address, browser, device identifiers" },
  { code: "content", label: "Customer content", description: "Files, documents, messages uploaded by customers" },
  { code: "payment", label: "Payment & billing data", description: "Billing address, transaction references" },
  { code: "employment", label: "Employment data", description: "Job titles, employer, HR records" },
  { code: "support", label: "Support communications", description: "Tickets, chat transcripts, call recordings" },
  { code: "location", label: "Location data", description: "Approximate or precise location" },
  { code: "sensitive", label: "Special category data", description: "Health, biometric or other sensitive data" },
] as const;

export type DataCategoryCode = (typeof DATA_CATEGORIES)[number]["code"];

export function dataCategoryLabel(code: string) {
  return DATA_CATEGORIES.find((c) => c.code === code)?.label ?? code;
}
