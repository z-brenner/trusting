import { test, expect } from "@playwright/test";
import { seedTrustCenter } from "./helpers/seed";
import { db } from "./helpers/db";

let docs: Record<string, string>;

test.describe("public Trust Center", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    docs = (await seedTrustCenter()).documents;
  });

  test("renders every section from the published snapshot", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Acme Analytics Trust Center/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Acme Analytics Trust Center");
    for (const section of ["Introduction", "Compliance overview", "Subprocessors", "Documents", "Contacts", "Personnel certifications"]) {
      await expect(page.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
    // Framework statuses are labelled honestly.
    await expect(page.getByText("ISO 27001")).toBeVisible();
    await expect(page.getByText("Certified", { exact: true })).toBeVisible();
    await expect(page.getByText("Self-attested alignment")).toBeVisible();
    await expect(page.getByText("Implementation in progress")).toBeVisible();
    // Subprocessors, locations and the map.
    await expect(page.getByText("Amazon Web Services (AWS)")).toBeVisible();
    await expect(page.getByText("Ireland").first()).toBeVisible();
    await expect(page.locator("svg[role=img], svg").filter({ has: page.locator("path") }).first()).toBeVisible();
    // Unpublished contact and private documents never appear.
    await expect(page.getByText("Hidden Person")).toHaveCount(0);
    await expect(page.getByText("Internal Runbook")).toHaveCount(0);
    await expect(page.getByText("anna@acme-analytics.example")).toBeVisible();
    await expect(page.getByText("+49 30 1234")).toHaveCount(0);
    // SEO: indexable, robots allows /
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toMatch(/index/);
    expect(robots).not.toMatch(/noindex/);
  });

  test("robots.txt protects admin surfaces", async ({ request }) => {
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt).toMatch(/Disallow: \/admin/);
    expect(txt).toMatch(/Disallow: \/api/);
  });

  test("map lists subprocessors for a selected country", async ({ page }) => {
    await page.goto("/#subprocessors");
    const ireland = page.getByRole("button", { name: /Ireland/ }).first();
    await ireland.click();
    await expect(page.getByText(/process(es)? data in Ireland/)).toBeVisible();
    await expect(page.getByText("Amazon Web Services (AWS)").nth(1)).toBeVisible();
  });

  test("public documents download through signed, expiring links; others are blocked", async ({ page, request }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /Download/ }).first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/api\/files\/[^/]+\?t=/);
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["content-disposition"]).toMatch(/attachment; filename="privacy-policy.pdf"/);

    // No token, tampered token, or private/request documents → rejected.
    expect((await request.get(`/api/files/${docs["Privacy Policy"]}`)).status()).toBe(403);
    expect((await request.get(`${href}x`)).status()).toBe(403);
    const forged = href!.replace(docs["Privacy Policy"], docs["Internal Runbook"]);
    expect((await request.get(forged)).status()).toBe(403);
  });

  test("tightening visibility in the draft takes effect without publishing", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.getByRole("link", { name: /Download/ }).first().getAttribute("href");
    await db().document.update({ where: { id: docs["Privacy Policy"] }, data: { visibility: "PRIVATE" } });
    expect((await request.get(href!)).status()).toBe(403);
    await db().document.update({ where: { id: docs["Privacy Policy"] }, data: { visibility: "PUBLIC" } });
    expect((await request.get(href!)).status()).toBe(200);
  });

  test("is responsive without horizontal overflow", async ({ page }) => {
    for (const width of [390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("shows a placeholder when unpublished", async ({ page }) => {
    const tc = await db().trustCenter.findUniqueOrThrow({ where: { id: "default" } });
    await db().trustCenter.update({ where: { id: "default" }, data: { currentPublicationId: null } });
    try {
      await page.goto("/");
      await expect(page.getByText(/hasn.t been published yet/)).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    } finally {
      await db().trustCenter.update({ where: { id: "default" }, data: { currentPublicationId: tc.currentPublicationId } });
    }
  });
});
