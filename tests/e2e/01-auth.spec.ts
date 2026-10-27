import { test, expect } from "@playwright/test";
import { ADMIN } from "./helpers/fixtures";

test.describe("administrator authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated visitors are redirected to login", async ({ page }) => {
    await page.goto("/admin/documents");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fdocuments/);
  });

  test("rejects a wrong password, keeps the email, and signs in with the right one", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ADMIN.email);
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect email address or password.")).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveValue(ADMIN.email);

    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Session cookie is HttpOnly.
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "tc_session");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rate limits repeated failed sign-ins", async ({ page }) => {
    await page.goto("/login");
    for (let i = 0; i < 10; i++) {
      await page.getByLabel("Email address").fill("victim@example.com");
      await page.getByLabel("Password").fill(`wrong-${i}`);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
    }
    await page.getByLabel("Password").fill("wrong-final");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/Too many sign-in attempts/)).toBeVisible();
  });

  test("API routes require a session", async ({ request }) => {
    const res = await request.post("/api/uploads/documents", { multipart: { file: { name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") } } });
    expect([401, 403]).toContain(res.status());
  });
});
