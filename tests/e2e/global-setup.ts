import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { E2E_DATABASE_URL, MOCK_GOOGLE_PORT, MOCK_MICROSOFT_PORT } from "../../playwright.config";

/**
 * Creates a clean database and storage folder, then starts the OAuth mock
 * providers used by the integration tests.
 */
export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(E2E_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const psql = (sql: string) => execSync(`psql "${adminUrl.toString()}" -v ON_ERROR_STOP=1 -c "${sql}"`, { stdio: "pipe" });
  psql(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  psql(`CREATE DATABASE ${dbName}`);
  execSync("pnpm prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
  });
  rmSync(path.resolve("storage-e2e"), { recursive: true, force: true });
  rmSync(path.resolve("tests/e2e/.auth"), { recursive: true, force: true });

  const { startMockProviders } = await import("../mocks/oauth-mock-server");
  const mocks = await startMockProviders({ googlePort: MOCK_GOOGLE_PORT, microsoftPort: MOCK_MICROSOFT_PORT });
  (globalThis as { __mocks?: { stop: () => Promise<void> | void } }).__mocks = mocks;
}
