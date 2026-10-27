/** "just now", "5 min ago", "3 days ago" — falls back to a short date beyond a month. */
export function relativeTime(input: Date | string, now: Date = new Date()): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const diff = now.getTime() - date.getTime();
  if (Number.isNaN(diff)) return "";
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** A compact one-line summary of audit metadata for lists. */
export function summarizeMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      parts.push(`${key}: ${value.length}`);
    } else if (typeof value === "object") {
      continue;
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
  }
  return parts.join(" · ").slice(0, 160);
}

/** Whether a date lies in the past (null/undefined count as not expired). */
export function isExpired(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getTime() < Date.now();
}

/** "10 November 2026" — used for grant expiry in the UI. */
export function formatLongDate(input: Date | string) {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
}
