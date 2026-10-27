import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a dedicated database and local storage folder,
 * with Google/Microsoft OAuth pointed at in-process mock servers.
 */
export const E2E_PORT = 3300;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5432/trustcenter_e2e";
export const MOCK_GOOGLE_PORT = 4100;
export const MOCK_MICROSOFT_PORT = 4200;

export const e2eEnv = {
  NODE_ENV: "test",
  PORT: String(E2E_PORT),
  APP_URL: E2E_BASE_URL,
  DATABASE_URL: E2E_DATABASE_URL,
  SESSION_SECRET: "e2e-session-secret-e2e-session-secret-e2e",
  ENCRYPTION_KEY: "22".repeat(32),
  STORAGE_DRIVER: "local",
  LOCAL_STORAGE_PATH: "./storage-e2e",
  MAX_UPLOAD_MB: "5",
  SCRYPT_LOG_N: "14",
  GOOGLE_CLIENT_ID: "test-google-client",
  GOOGLE_CLIENT_SECRET: "test-google-secret",
  GOOGLE_OAUTH_BASE_URL: `http://127.0.0.1:${MOCK_GOOGLE_PORT}`,
  GOOGLE_API_BASE_URL: `http://127.0.0.1:${MOCK_GOOGLE_PORT}`,
  MICROSOFT_CLIENT_ID: "test-ms-client",
  MICROSOFT_CLIENT_SECRET: "test-ms-secret",
  MICROSOFT_OAUTH_BASE_URL: `http://127.0.0.1:${MOCK_MICROSOFT_PORT}`,
  MICROSOFT_GRAPH_BASE_URL: `http://127.0.0.1:${MOCK_MICROSOFT_PORT}`,
};

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /00-setup\.spec\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/admin.json" },
      dependencies: ["setup"],
      testIgnore: /00-setup\.spec\.ts/,
    },
  ],
  webServer: {
    command: "pnpm next dev -p 3300",
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: e2eEnv,
  },
});
