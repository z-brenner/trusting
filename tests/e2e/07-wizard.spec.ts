import { test, expect } from "@playwright/test";
import { db } from "./helpers/db";
import { ANON, fixturePath } from "./helpers/fixtures";

test.describe("guided editor", () => {
  test("step 1 autosaves company information and uploads a logo", async ({ page }) => {
    await page.goto("/admin/edit/1");
    await expect(page.getByRole("heading", { name: "Company information" })).toBeVisible();
    await page.getByLabel("Tagline").fill("Security you can verify.");
    await page.getByLabel("Website", { exact: true }).fill("not a url");
    await expect(page.getByText("Must start with http:// or https://")).toBeVisible();
    await page.getByLabel("Website", { exact: true }).fill("https://acme-analytics.example");
    await expect(page.getByText(/Saved/)).toBeVisible();
    await expect.poll(async () => (await db().trustCenter.findUniqueOrThrow({ where: { id: "default" } })).tagline).toBe("Security you can verify.");

    await page.locator('input[type="file"][aria-label="Upload logo"]').setInputFiles(fixturePath("logo.png"));
    await expect(page.getByRole("img", { name: "Company logo" })).toBeVisible();
    await expect.poll(async () => (await db().trustCenter.findUniqueOrThrow({ where: { id: "default" } })).logoMime).toBe("image/png");
    const logo = await page.request.get("/api/logo");
    expect(logo.status()).toBe(200);
    expect(logo.headers()["content-type"]).toBe("image/png");

    await page.reload();
    await expect(page.getByLabel("Tagline")).toHaveValue("Security you can verify.");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/admin\/edit\/2/);
    expect((await db().trustCenter.findUniqueOrThrow({ where: { id: "default" } })).wizardStep).toBe(2);
  });

  test("step 2 searches the vendor directory, selects vendors and edits processing locations", async ({ page }) => {
    await page.goto("/admin/edit/2");
    await page.getByLabel("Search vendors").fill("azure");
    const azure = page.getByRole("checkbox", { name: /Microsoft Azure/ });
    await expect(azure).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Stripe/ })).toHaveCount(0);
    await azure.check();
    await expect.poll(() => db().subprocessor.count({ where: { vendorSlug: "azure" } })).toBe(1);
    await expect(page.getByText("No locations set").first()).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: "Microsoft Azure" }).filter({ has: page.getByRole("button", { name: "Edit" }) }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(/headquarters is not necessarily a processing location/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: /regions page/ })).toBeVisible();
    await dialog.getByLabel("Services provided").fill("Virtual machines and blob storage");
    const loc = dialog.getByLabel("Processing locations");
    await loc.fill("Netherlands");
    await loc.press("Enter");
    await loc.fill("EU");
    await loc.press("Enter");
    await expect(dialog.getByRole("button", { name: "Remove Netherlands" })).toBeVisible();
    await dialog.getByRole("checkbox", { name: /Customer content/ }).check();
    await dialog.getByRole("button", { name: /Save/ }).click();
    await expect(dialog).toBeHidden();
    const saved = await db().subprocessor.findFirstOrThrow({ where: { vendorSlug: "azure" } });
    expect(saved.locations.sort()).toEqual(["EU", "NL"]);
    expect(saved.dataCategories).toEqual(["content"]);

    await page.getByRole("button", { name: "Add custom subprocessor" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Save|Add/ }).click();
    await expect(page.getByRole("dialog").getByText("Enter the vendor name")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Vendor name").fill("Acme Payroll Ltd");
    await page.getByRole("dialog").getByRole("button", { name: /Save|Add/ }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Acme Payroll Ltd").first()).toBeVisible();

    await page.getByLabel("Search vendors").fill("azure");
    await page.getByRole("checkbox", { name: /Microsoft Azure/ }).uncheck();
    await expect.poll(() => db().subprocessor.count({ where: { vendorSlug: "azure" } })).toBe(0);
  });

  test("step 3 only offers statuses that are true to the framework type", async ({ page }) => {
    await page.goto("/admin/edit/3");
    await expect(page.getByText(/does not claim certification/i)).toBeVisible();
    await page.getByLabel("Search frameworks").fill("HIPAA");
    await page.getByRole("checkbox", { name: /HIPAA/ }).check();
    await expect.poll(() => db().frameworkEntry.count({ where: { frameworkSlug: "hipaa" } })).toBe(1);
    const toggle = page.locator('button[aria-controls="fw-hipaa-panel"]');
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    const status = page.locator("#fw-hipaa-status");
    await expect(status).toBeVisible();
    const options = await status.locator("option").allTextContents();
    expect(options.join(" ")).not.toMatch(/Certified/);
    expect(options.join(" ")).toMatch(/Applicable/);
    await status.selectOption("APPLICABLE");
    await page.locator("#fw-hipaa-note").fill("We act as a business associate.");
    await page.locator("#fw-hipaa-panel").getByRole("button", { name: "Save" }).click();
    await expect.poll(async () => (await db().frameworkEntry.findFirstOrThrow({ where: { frameworkSlug: "hipaa" } })).status).toBe("APPLICABLE");

    // GDPR cannot be "Certified" through the API either.
    const gdpr = page.locator("#fw-gdpr-status");
    if (await gdpr.count()) {
      const gdprOptions = await gdpr.locator("option").allTextContents();
      expect(gdprOptions.join(" ")).not.toMatch(/Certified/);
    }
  });

  test("step 4 manages contacts and personnel credentials", async ({ page }) => {
    await page.goto("/admin/edit/4");
    await page.getByRole("button", { name: "Add contact" }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog.getByText("Enter a name")).toBeVisible();
    await dialog.getByLabel("Name", { exact: true }).fill("Priya Natarajan");
    await dialog.getByLabel("Job title").fill("Head of Platform");
    await dialog.getByLabel("Email", { exact: true }).fill("priya@acme-analytics.example");
    await dialog.getByRole("switch", { name: "Publish email address" }).click();
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Priya Natarajan")).toBeVisible();
    const contact = await db().contact.findFirstOrThrow({ where: { name: "Priya Natarajan" } });
    expect(contact.publishEmail).toBe(true);

    await page.getByRole("button", { name: "Add credential" }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Certification").fill("CISM – Certified Information Security Manager");
    await expect(dialog.getByLabel("Issuer")).toHaveValue("ISACA");
    await dialog.getByLabel("Holder", { exact: true }).selectOption(contact.id);
    await dialog.getByLabel("Issued").fill("2024-05-01");
    await dialog.getByLabel("Expires").fill("2027-05-01");
    await dialog.getByLabel("Credential ID").fill("CISM-123");
    await dialog.getByRole("button", { name: "Add credential" }).click();
    await expect(dialog).toBeHidden();
    const cert = await db().certification.findFirstOrThrow({ where: { credentialId: "CISM-123" } });
    expect(cert.holderId).toBe(contact.id);
    expect(cert.issuer).toBe("ISACA");
  });

  test("step 5 embeds the document manager and step 6 publishes", async ({ page, browser }) => {
    await page.goto("/admin/edit/5");
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath("policy.pdf"));
    await expect.poll(() => db().document.count({ where: { fileName: "policy.pdf" } })).toBeGreaterThan(0);

    await page.goto("/admin/edit/6");
    await expect(page.getByRole("heading", { name: /Preview/ }).first()).toBeVisible();
    await expect(page.getByText(/Unpublished changes/)).toBeVisible();
    await page.getByRole("button", { name: /Update published version|Publish Trust Center/ }).click();
    await expect(page.getByText(/Version \d+ is live/)).toBeVisible();
    await page.getByRole("button", { name: "Copy public URL" }).click();
    await expect(page.getByText("http://localhost:3300", { exact: false }).first()).toBeVisible();

    const visitor = await browser.newContext(ANON);
    const vp = await visitor.newPage();
    await vp.goto("/");
    await expect(vp.getByText("Priya Natarajan").first()).toBeVisible();
    await expect(vp.getByText("priya@acme-analytics.example")).toBeVisible();
    await expect(vp.getByText("Acme Payroll Ltd").first()).toBeVisible();
    await expect(vp.getByText("HIPAA").first()).toBeVisible();
    await visitor.close();
  });

  test("the preview page is admin-only and embeddable by the editor only", async ({ page, browser }) => {
    const res = await page.request.get("/preview");
    expect(res.status()).toBe(200);
    expect(res.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers()["content-security-policy"]).toMatch(/frame-ancestors 'self'/);
    const home = await page.request.get("/");
    expect(home.headers()["x-frame-options"]).toBe("DENY");
    const anon = await browser.newContext(ANON);
    const r = await anon.request.get("/preview", { maxRedirects: 0 });
    expect([302, 303, 307]).toContain(r.status());
    await anon.close();
  });
});
