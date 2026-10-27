import { test, expect } from "@playwright/test";
import { seedTrustCenter } from "./helpers/seed";
import { fixturePath } from "./helpers/fixtures";
import { db } from "./helpers/db";

test.describe("document management", () => {
  test.beforeAll(async () => {
    await seedTrustCenter();
  });

  test("uploads a PDF privately, rejects disguised executables, edits visibility and deletes", async ({ page }) => {
    await page.goto("/admin/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    // Content sniffing: an executable renamed to .pdf is rejected.
    await page.locator('input[type="file"]').setInputFiles(fixturePath("renamed.pdf"));
    await expect(page.getByText("This file type is not supported.")).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(fixturePath("policy.pdf"));
    await expect(page.getByText("policy", { exact: false }).first()).toBeVisible();
    const uploaded = await expect
      .poll(async () => db().document.findFirst({ where: { fileName: "policy.pdf" } }))
      .not.toBeNull()
      .then(() => db().document.findFirstOrThrow({ where: { fileName: "policy.pdf" } }));
    expect(uploaded.visibility).toBe("PRIVATE");
    expect(uploaded.storageKey).toMatch(/^documents\//);
    const storageKey = uploaded.storageKey;

    // Not in the published snapshot → never downloadable publicly, even with a signed public token minted elsewhere.
    expect((await page.request.get(`/api/files/${uploaded.id}`)).status()).toBe(403);

    await page.reload();
    await page.getByRole("button", { name: `Edit ${uploaded.title}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Information Security Policy");
    await dialog.getByLabel("Category").selectOption("SECURITY_POLICY");
    await dialog.getByLabel("Version").fill("v3");
    await dialog.getByRole("radio", { name: /Request access/ }).check();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await db().document.findUniqueOrThrow({ where: { id: uploaded.id } })).visibility).toBe("REQUEST");
    expect(await db().auditLog.count({ where: { action: "document.visibility_changed", targetId: uploaded.id } })).toBe(1);

    // Admin open link works and is audited.
    await page.reload();
    const [popup] = await Promise.all([
      page.waitForEvent("popup").catch(() => null),
      page.getByRole("button", { name: "Open Information Security Policy" }).click(),
    ]);
    if (popup) {
      await popup.waitForLoadState();
      expect(popup.url()).toMatch(/\/api\/files\//);
      await popup.close();
    }
    await expect.poll(() => db().auditLog.count({ where: { action: "document.downloaded", targetId: uploaded.id } })).toBeGreaterThan(0);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Delete Information Security Policy" }).click();
    await expect.poll(() => db().document.findUnique({ where: { id: uploaded.id } })).toBeNull();
    const { existsSync } = await import("node:fs");
    expect(existsSync(`storage-e2e/${storageKey}`)).toBe(false);
  });

  test("storage keys are not reachable through predictable URLs", async ({ request }) => {
    const doc = await db().document.findFirstOrThrow({ where: { visibility: "PRIVATE" } });
    for (const url of [`/storage-e2e/${doc.storageKey}`, `/${doc.storageKey}`, `/api/files/${doc.id}`, `/api/files/${doc.id}?t=forged`]) {
      const res = await request.get(url);
      expect([403, 404], url).toContain(res.status());
    }
  });
});
