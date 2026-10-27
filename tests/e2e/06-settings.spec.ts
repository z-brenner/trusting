import { test, expect } from "@playwright/test";
import { ADMIN, ANON } from "./helpers/fixtures";
import { db } from "./helpers/db";

test.describe("settings", () => {
  test("adds and removes an administrator", async ({ page, browser }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Add administrator" }).click();
    await page.getByLabel("Name", { exact: true }).last().fill("Sam Second");
    await page.getByLabel("Email address").last().fill("sam@example.com");
    await page.getByLabel("Temporary password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 12 characters")).toBeVisible();
    await page.getByLabel("Temporary password").fill("sam-temporary-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("sam@example.com")).toBeVisible();

    const other = await browser.newContext(ANON);
    const op = await other.newPage();
    await op.goto("/login");
    await op.getByLabel("Email address").fill("sam@example.com");
    await op.getByLabel("Password").fill("sam-temporary-password-1");
    await op.getByRole("button", { name: "Sign in" }).click();
    await expect(op).toHaveURL(/\/admin$/);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("listitem").filter({ hasText: "sam@example.com" }).getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("sam@example.com")).toHaveCount(0);
    await op.goto("/admin");
    await expect(op).toHaveURL(/\/login/);
    await other.close();
    expect(await db().adminUser.count({ where: { email: "sam@example.com" } })).toBe(0);
  });

  test("changes the password and signs out other sessions", async ({ page, browser }) => {
    // A second, independent session for the same administrator.
    const other = await browser.newContext(ANON);
    const op = await other.newPage();
    await op.goto("/login");
    await op.getByLabel("Email address").fill(ADMIN.email);
    await op.getByLabel("Password").fill(ADMIN.password);
    await op.getByRole("button", { name: "Sign in" }).click();
    await expect(op).toHaveURL(/\/admin$/);

    await page.goto("/admin/settings");
    await page.getByLabel("Current password").fill("wrong-current-password");
    await page.getByLabel("New password", { exact: true }).fill("new-admin-password-2026");
    await page.getByLabel("Confirm new password").fill("new-admin-password-2026");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Current password is incorrect")).toBeVisible();

    await page.getByLabel("Current password").fill(ADMIN.password);
    await page.getByLabel("New password", { exact: true }).fill("new-admin-password-2026");
    await page.getByLabel("Confirm new password").fill("new-admin-password-2026");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password updated")).toBeVisible();

    await op.goto("/admin");
    await expect(op).toHaveURL(/\/login/);
    await other.close();

    // Restore for later specs.
    await page.getByLabel("Current password").fill("new-admin-password-2026");
    await page.getByLabel("New password", { exact: true }).fill(ADMIN.password);
    await page.getByLabel("Confirm new password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Password updated")).toBeVisible();
  });
});
