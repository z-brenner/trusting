import { describe, expect, it, afterAll } from "vitest";
import { rmSync } from "node:fs";
import { LocalStorage } from "@/lib/storage/local";

const root = "./storage-test-local";
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("local storage driver", () => {
  it("round-trips objects and refuses path traversal", async () => {
    const s = new LocalStorage(root);
    await s.put("documents/ab/x.pdf", Buffer.from("hello"));
    const got = await s.get("documents/ab/x.pdf");
    expect(got?.size).toBe(5);
    const chunks: Buffer[] = [];
    for await (const c of got!.stream) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).toString()).toBe("hello");
    await expect(s.put("../outside.txt", Buffer.from("x"))).rejects.toThrow(/Invalid storage key/);
    await expect(s.get("documents/../../etc/passwd")).rejects.toThrow(/Invalid storage key/);
    await s.delete("documents/ab/x.pdf");
    expect(await s.exists("documents/ab/x.pdf")).toBe(false);
  });
});
