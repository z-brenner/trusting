import { defineConfig, devices } from "@playwright/test";
import base, { E2E_BASE_URL } from "./playwright.config";

/**
 * Generates the README screenshots (docs/screenshots/*.png) from a seeded
 * instance. Run with: pnpm screenshots
 */
export default defineConfig({
  ...base,
  testDir: "./tests",
  reporter: [["list"]],
  projects: [
    { name: "setup", testMatch: /e2e\/00-setup\.spec\.ts/ },
    {
      name: "screenshots",
      testMatch: /screenshots\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/admin.json", baseURL: E2E_BASE_URL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
      dependencies: ["setup"],
    },
  ],
});
