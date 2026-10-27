import { test, expect } from "@playwright/test";
import { seedTrustCenter } from "./helpers/seed";
import { db } from "./helpers/db";

test.describe("publishing", () => {
  test.beforeAll(async () => {
    await seedTrustCenter();
  });

  test("draft edits stay private until published; unpublish hides the site", async ({ page, browser }) => {
    await db().trustCenter.update({ where: { id: "default" }, data: { tagline: "A brand new tagline" } });

    const visitor = await browser.newContext();
    const vp = await visitor.newPage();
    await vp.goto("/");
    await expect(vp.getByText("A brand new tagline")).toHaveCount(0);

    await page.goto("/admin");
    await expect(page.getByText("You have unpublished changes")).toBeVisible();
    await expect(page.getByText(/^http:\/\/localhost:3300\/?$/)).toBeVisible();
    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByText(/Published version \d+/)).toBeVisible();

    await vp.reload();
    await expect(vp.getByText("A brand new tagline")).toBeVisible();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByText("Draft — not published").or(page.getByText(/not published/i)).first()).toBeVisible();
    await vp.reload();
    await expect(vp.getByText(/hasn.t been published yet/)).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/Published version \d+/)).toBeVisible();
    await vp.reload();
    await expect(vp.getByRole("heading", { level: 1 })).toContainText("Acme Analytics");
    await visitor.close();

    const versions = await db().publication.count();
    expect(versions).toBeGreaterThanOrEqual(3);
  });
});
