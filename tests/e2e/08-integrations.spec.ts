import { test, expect } from "@playwright/test";
import { db } from "./helpers/db";
import { ANON } from "./helpers/fixtures";

/**
 * Exercises the real OAuth + import code paths against the in-process mock
 * Google / Microsoft servers (see tests/mocks/oauth-mock-server.ts).
 */
test.describe("Google Drive and OneDrive integrations (mocked providers)", () => {
  test("connects Google Drive with PKCE, imports files as private documents, disconnects", async ({ page }) => {
    await page.goto("/admin/integrations");
    await page.getByRole("link", { name: "Connect Google Drive" }).click();
    await expect(page).toHaveURL(/\/admin\/integrations\?connected=google/);
    await expect(page.getByText("security@example.com")).toBeVisible();
    const row = await db().integration.findUniqueOrThrow({ where: { provider: "GOOGLE_DRIVE" } });
    expect(row.accessTokenEnc.startsWith("v1.")).toBe(true);
    expect(row.refreshTokenEnc?.startsWith("v1.")).toBe(true);
    expect(await db().auditLog.count({ where: { action: "integration.connected" } })).toBeGreaterThan(0);

    await page.goto("/admin/documents");
    await page.getByRole("button", { name: "Import from Google Drive" }).click();
    const picker = page.getByRole("dialog");
    await expect(picker.getByText("SOC 2 Type II Report.pdf")).toBeVisible();
    await expect(picker.getByText("Old policy (trashed).pdf")).toHaveCount(0);

    // Search, then back to browsing.
    await picker.getByLabel("Search Google Drive").fill("penetration");
    await expect(picker.getByText("Penetration test 2026.pdf")).toBeVisible();
    await picker.getByRole("button", { name: "Clear search" }).click();
    await expect(picker.getByText("SOC 2 Type II Report.pdf")).toBeVisible();
    await picker.getByRole("checkbox", { name: "Select SOC 2 Type II Report.pdf" }).check();
    await picker.getByRole("checkbox", { name: "Select Information Security Policy" }).check();
    await picker.getByRole("checkbox", { name: "Select installer.exe" }).check();
    await picker.getByRole("button", { name: /^Import 3 files/ }).click();
    await expect(picker.getByText("Imported 2 documents")).toBeVisible();
    await expect(picker.getByText("1 file was not imported")).toBeVisible();
    const imported = await db().document.findMany({ where: { source: "GOOGLE_DRIVE" } });
    expect(imported.map((d) => d.title).sort()).toEqual(["Information Security Policy", "SOC 2 Type II Report"]);
    expect(imported.every((d) => d.visibility === "PRIVATE")).toBe(true);
    expect(imported.find((d) => d.title === "Information Security Policy")?.fileName).toBe("Information Security Policy.pdf");
    expect(imported.find((d) => d.title === "Information Security Policy")?.mimeType).toBe("application/pdf");

    await page.goto("/admin/integrations");
    await page.getByRole("button", { name: "Disconnect" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
    await expect(page).toHaveURL(/disconnected=google/);
    expect(await db().integration.findUnique({ where: { provider: "GOOGLE_DRIVE" } })).toBeNull();
  });

  test("connects OneDrive and imports a file", async ({ page }) => {
    await page.goto("/admin/integrations");
    await page.getByRole("link", { name: "Connect OneDrive" }).click();
    await expect(page).toHaveURL(/connected=microsoft/);
    await page.goto("/admin/documents");
    await page.getByRole("button", { name: "Import from OneDrive" }).click();
    const picker = page.getByRole("dialog");
    const first = picker.getByRole("checkbox", { name: /Select .*\.pdf/ }).first();
    await first.check();
    await picker.getByRole("button", { name: /^Import 1 file/ }).click();
    await expect.poll(() => db().document.count({ where: { source: "ONEDRIVE" } })).toBe(1);
    const doc = await db().document.findFirstOrThrow({ where: { source: "ONEDRIVE" } });
    expect(doc.visibility).toBe("PRIVATE");
    expect(doc.externalId).toBeTruthy();
  });

  test("rejects tampered OAuth state and unauthenticated access", async ({ page, browser }) => {
    const res = await page.request.get("/api/integrations/google/callback?code=abc&state=forged", { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(res.status());
    expect(res.headers()["location"]).toMatch(/error=state/);
    const anon = await browser.newContext(ANON);
    const start = await anon.request.get("/api/integrations/google/start", { maxRedirects: 0 });
    expect([302, 303, 307, 401]).toContain(start.status());
    expect(start.headers()["location"] ?? "").not.toMatch(/4100/);
    const files = await anon.request.get("/api/integrations/google/files");
    expect(files.status()).toBe(401);
    await anon.close();
  });
});
