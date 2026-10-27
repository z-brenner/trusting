/**
 * Small in-memory sliding-window rate limiter.
 *
 * This product is designed to run as a single instance per organisation, so an
 * in-process limiter is sufficient and keeps the deployment simple. If you run
 * several replicas, put a rate limit at your reverse proxy as well.
 */
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    buckets.set(key, bucket);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { ok: true };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export const LIMITS = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  setup: { limit: 5, windowMs: 15 * 60_000 },
  accessRequest: { limit: 5, windowMs: 60 * 60_000 },
  upload: { limit: 60, windowMs: 60 * 60_000 },
  download: { limit: 120, windowMs: 60_000 },
  passwordChange: { limit: 5, windowMs: 15 * 60_000 },
} as const;
