import { test, expect } from "@playwright/test";
import { ADMIN, COMPANY, waitForHydration } from "./helpers/fixtures";

/**
 * First-run setup: creates the administrator through the UI and stores the
 * authenticated browser state for the other specs.
 */
test("first run redirects to setup and creates the administrator", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/setup$/);
  const login = await page.request.get("/login", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(login.status());
  expect(login.headers()["location"]).toMatch(/\/setup$/);

  // Wait for hydration so the form submits through the client (cold dev servers compile lazily).
  await page.goto("/setup");
  await waitForHydration(page);
  await page.getByLabel("Company name").fill(COMPANY);
  await page.getByLabel("Your name").fill(ADMIN.name);
  await page.getByLabel("Email address").fill(ADMIN.email);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create administrator account" }).click();
  await expect(page.getByText("Use at least 12 characters")).toBeVisible();

  await page.getByLabel("Company name").fill(COMPANY);
  await page.getByLabel("Your name").fill(ADMIN.name);
  await page.getByLabel("Email address").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Create administrator account" }).click();
  await expect(page).toHaveURL(/\/admin\/edit\/1/);

  // Setup is now locked.
  await page.goto("/setup");
  await expect(page).not.toHaveURL(/\/setup$/);

  await page.context().storageState({ path: "tests/e2e/.auth/admin.json" });
});
