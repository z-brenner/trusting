import { describe, expect, it } from "vitest";
import { mostRestrictive, hashGrantToken, GRANT_DEFAULT_DAYS } from "@/lib/documents/access";
import { accessApprovedEmail, accessRejectedEmail } from "@/lib/email-templates";
import { relativeTime, summarizeMetadata } from "@/components/admin/dashboard/relative-time";

describe("mostRestrictive", () => {
  it("returns the stricter of two visibilities", () => {
    expect(mostRestrictive("PUBLIC", "PUBLIC")).toBe("PUBLIC");
    expect(mostRestrictive("PUBLIC", "REQUEST")).toBe("REQUEST");
    expect(mostRestrictive("REQUEST", "PUBLIC")).toBe("REQUEST");
    expect(mostRestrictive("REQUEST", "PRIVATE")).toBe("PRIVATE");
    expect(mostRestrictive("PRIVATE", "PUBLIC")).toBe("PRIVATE");
    expect(mostRestrictive("PRIVATE", "PRIVATE")).toBe("PRIVATE");
  });
  it("is commutative", () => {
    const all = ["PUBLIC", "REQUEST", "PRIVATE"] as const;
    for (const a of all) for (const b of all) expect(mostRestrictive(a, b)).toBe(mostRestrictive(b, a));
  });
});

describe("grant tokens", () => {
  it("hashes deterministically and never stores the token itself", () => {
    const token = "abc123-token";
    expect(hashGrantToken(token)).toBe(hashGrantToken(token));
    expect(hashGrantToken(token)).not.toContain(token);
    expect(hashGrantToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("defaults to a two-week grant", () => {
    expect(GRANT_DEFAULT_DAYS).toBe(14);
  });
});

describe("email templates", () => {
  const expiresAt = new Date("2026-11-10T12:00:00Z");
  it("includes link, expiry and documents in both variants", () => {
    const mail = accessApprovedEmail({
      requesterName: "Ada",
      companyName: "Acme",
      documentTitles: ["SOC 2 report", "Pen test 2026"],
      link: "https://trust.example.com/access/tok",
      expiresAt,
    });
    expect(mail.subject).toContain("Acme");
    expect(mail.text).toContain("https://trust.example.com/access/tok");
    expect(mail.text).toContain("SOC 2 report");
    expect(mail.html).toContain("https://trust.example.com/access/tok");
    expect(mail.html).toContain("Pen test 2026");
    expect(mail.html).toContain("10 November 2026");
  });
  it("escapes HTML in user-controlled fields", () => {
    const mail = accessApprovedEmail({
      requesterName: "<script>alert(1)</script>",
      companyName: "Acme & Co",
      documentTitles: ['<img src=x onerror="x">'],
      link: "https://trust.example.com/access/tok?a=1&b=2",
      expiresAt,
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("Acme &amp; Co");
    expect(mail.html).not.toContain('onerror="x"');
    expect(mail.html).toContain("a=1&amp;b=2");
    // Plain text is left as is.
    expect(mail.text).toContain("<script>alert(1)</script>");
  });
  it("includes the rejection reason only when given", () => {
    const withReason = accessRejectedEmail({ requesterName: "Ada", companyName: "Acme", reason: "Not a <customer>" });
    expect(withReason.text).toContain("Reason: Not a <customer>");
    expect(withReason.html).toContain("Not a &lt;customer&gt;");
    const without = accessRejectedEmail({ requesterName: "Ada", companyName: "", reason: "  " });
    expect(without.text).not.toContain("Reason:");
    expect(without.html).not.toContain("<blockquote");
    expect(without.subject).toContain("the Trust Center");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("formats recent times relatively", () => {
    expect(relativeTime(new Date("2026-10-27T11:59:50Z"), now)).toBe("just now");
    expect(relativeTime(new Date("2026-10-27T11:55:00Z"), now)).toBe("5 min ago");
    expect(relativeTime(new Date("2026-10-27T09:00:00Z"), now)).toBe("3 hours ago");
    expect(relativeTime(new Date("2026-10-26T11:00:00Z"), now)).toBe("1 day ago");
    expect(relativeTime(new Date("2026-10-20T12:00:00Z"), now)).toBe("7 days ago");
  });
  it("falls back to a date after a month", () => {
    expect(relativeTime(new Date("2026-08-01T12:00:00Z"), now)).toMatch(/2026/);
  });
});

describe("summarizeMetadata", () => {
  it("flattens scalars, counts arrays and skips nested objects", () => {
    expect(summarizeMetadata({ title: "DPA", documentIds: ["a", "b"], nested: { x: 1 }, empty: "", nil: null })).toBe(
      "title: DPA · documentIds: 2",
    );
    expect(summarizeMetadata(null)).toBe("");
    expect(summarizeMetadata("str")).toBe("");
  });
});
