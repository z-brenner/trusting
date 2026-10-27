import { test, expect } from "@playwright/test";
import { seedTrustCenter, hashToken } from "./helpers/seed";
import { db } from "./helpers/db";
import { ANON } from "./helpers/fixtures";

let docs: Record<string, string>;

test.describe("document access requests", () => {
  test.beforeAll(async () => {
    docs = (await seedTrustCenter()).documents;
  });

  test("a visitor can request access and the request appears for the administrator", async ({ browser, page }) => {
    const visitor = await browser.newContext(ANON);
    const vp = await visitor.newPage();
    await vp.goto("/");
    await vp.getByRole("button", { name: "Request access", exact: true }).first().click();
    const dialog = vp.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Request access to documents" })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: /Penetration Test Summary/ })).toBeChecked();
    await dialog.getByRole("checkbox", { name: /SOC 2 Report/ }).check();
    await dialog.getByLabel("Your name").fill("Jane Buyer");
    await dialog.getByLabel("Work email").fill("not-an-email");
    await dialog.getByRole("button", { name: /Send request|Submit/ }).click();
    await expect(dialog.getByRole("alert").first()).toBeVisible();
    await dialog.getByLabel("Work email").fill("jane@customer.example");
    await dialog.getByLabel("Company").fill("Customer Co");
    await dialog.getByLabel("Message").fill("Vendor review for procurement.");
    await dialog.getByRole("button", { name: /Send request|Submit/ }).click();
    await expect(vp.getByText("We’ve received your request.")).toBeVisible();
    await visitor.close();

    const req = await db().accessRequest.findFirstOrThrow({ where: { requesterEmail: "jane@customer.example" }, include: { documents: true } });
    expect(req.status).toBe("PENDING");
    expect(req.documents.length).toBeGreaterThan(0);

    // Administrator sees it on the dashboard and the requests page.
    await page.goto("/admin");
    await expect(page.getByText("Jane Buyer")).toBeVisible();
    await page.goto("/admin/requests");
    await expect(page.getByText("Jane Buyer")).toBeVisible();
  });

  test("the public endpoint rejects cross-site posts and honours the honeypot", async ({ request }) => {
    const payload = { requesterName: "Bot", requesterEmail: "bot@example.com", company: "", message: "", documentIds: [docs["SOC 2 Report"]] };
    const cross = await request.post("/api/access-requests", { data: payload, headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" } });
    expect(cross.status()).toBe(403);
    const honey = await request.post("/api/access-requests", { data: { ...payload, website: "http://spam" }, headers: { origin: "http://localhost:3300", "sec-fetch-site": "same-origin" } });
    expect(honey.status()).toBe(200);
    expect(await db().accessRequest.count({ where: { requesterEmail: "bot@example.com" } })).toBe(0);
  });

  test("approval grants time-limited access; rejection and expiry block it", async ({ page, browser }) => {
    const req = await db().accessRequest.findFirstOrThrow({ where: { requesterEmail: "jane@customer.example" } });
    await page.goto(`/admin/requests/${req.id}`);
    await page.getByRole("button", { name: "Approve and send link" }).click();
    // SMTP is not configured in tests, so the one-time link is shown to the admin.
    await expect(page.getByText("Approved — send the link yourself")).toBeVisible();
    const linkText = await page.locator("code", { hasText: "/access/" }).first().textContent();
    const grantUrl = linkText!.match(/\/access\/[A-Za-z0-9_-]+/)![0];
    const updated = await db().accessRequest.findUniqueOrThrow({ where: { id: req.id } });
    expect(updated.status).toBe("APPROVED");
    expect(updated.grantTokenHash).toBe(hashToken(grantUrl.split("/access/")[1]));
    expect(updated.grantExpiresAt!.getTime()).toBeGreaterThan(Date.now());

    const visitor = await browser.newContext(ANON);
    const vp = await visitor.newPage();
    await vp.goto(grantUrl);
    await expect(vp).toHaveURL(/\/access$/);
    await expect(vp.getByText("Penetration Test Summary").first()).toBeVisible();
    await expect(vp.getByText("Internal Runbook")).toHaveCount(0);
    const href = await vp.getByRole("link", { name: /Download/ }).first().getAttribute("href");
    const res = await vp.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");

    // Without the grant cookie the same link is useless.
    const stranger = await browser.newContext(ANON);
    expect((await stranger.request.get(href!)).status()).toBe(403);
    await stranger.close();

    // Expiry.
    await db().accessRequest.update({ where: { id: req.id }, data: { grantExpiresAt: new Date(Date.now() - 1000) } });
    expect((await vp.request.get(href!)).status()).toBe(403);
    await vp.goto(grantUrl);
    await expect(vp.getByText(/isn.t valid|No active document access/)).toBeVisible();
    await visitor.close();

    // Rejection path on a second request.
    const second = await db().accessRequest.create({
      data: { requesterName: "Rick Reject", requesterEmail: "rick@customer.example", documents: { create: [{ documentId: docs["SOC 2 Report"] }] } },
    });
    await page.goto(`/admin/requests/${second.id}`);
    await page.getByLabel("Reason").fill("Not a customer.");
    await page.getByRole("button", { name: "Reject request" }).click();
    await expect(page.getByText("Request rejected")).toBeVisible();
    await expect.poll(async () => (await db().accessRequest.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("REJECTED");
  });
});
