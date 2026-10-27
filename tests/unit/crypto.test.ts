import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, encryptSecret, decryptSecret, signPayload, verifyPayload, randomToken } from "@/lib/crypto";

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("produces unique salts", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toEqual(b);
  });
});

describe("secret encryption", () => {
  it("round-trips and detects tampering", () => {
    const enc = encryptSecret("ya29.token");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptSecret(enc)).toBe("ya29.token");
    const parts = enc.split(".");
    parts[2] = parts[2].slice(0, -2) + "AA";
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});

describe("signed payloads", () => {
  it("verifies valid tokens and rejects expired or tampered ones", () => {
    const token = signPayload({ d: "doc1", via: "public" }, 60);
    const payload = verifyPayload<{ d: string; via: string }>(token);
    expect(payload?.d).toBe("doc1");
    expect(verifyPayload(token + "x")).toBeNull();
    const expired = signPayload({ d: "doc1" }, -1);
    expect(verifyPayload(expired)).toBeNull();
  });
  it("random tokens are url safe", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
