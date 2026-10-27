import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit then blocks with a retry hint", () => {
    const key = "t:" + Math.random();
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    resetRateLimit(key);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
  });
});
