import { test, expect } from "@playwright/test";
import { seedTrustCenter } from "../e2e/helpers/seed";

const out = (name: string) => `docs/screenshots/${name}.png`;

test.describe("README screenshots", () => {
  test.beforeAll(async () => {
    await seedTrustCenter();
  });

  test("public page", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.screenshot({ path: out("public"), fullPage: true });
    await page.locator("#subprocessors").scrollIntoViewIfNeeded();
    const map = page.locator("svg").filter({ has: page.locator("path") }).first();
    await map.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /Ireland/ }).first().click();
    await page.locator("section#subprocessors").screenshot({ path: out("map") });
  });

  test("admin pages", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await page.screenshot({ path: out("dashboard"), fullPage: false });
    await page.goto("/admin/edit/2");
    await expect(page.getByRole("heading", { level: 1, name: "Subprocessors" })).toBeVisible();
    await page.screenshot({ path: out("editor"), fullPage: false });
    await page.goto("/admin/documents");
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.screenshot({ path: out("documents"), fullPage: false });
  });
});
