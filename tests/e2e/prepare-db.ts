import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { E2E_DATABASE_URL } from "../../playwright.config";

/**
 * Creates a clean end-to-end database and storage folder. Runs as part of the
 * Playwright webServer command so the app can answer its health check.
 */
const url = new URL(E2E_DATABASE_URL);
const dbName = url.pathname.slice(1);
const adminUrl = new URL(E2E_DATABASE_URL);
adminUrl.pathname = "/postgres";
const psql = (sql: string) =>
  execSync(`psql "${adminUrl.toString()}" -v ON_ERROR_STOP=1 -c "${sql}"`, { stdio: "pipe" });
psql(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
psql(`CREATE DATABASE ${dbName}`);
execSync("pnpm prisma migrate deploy", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
});
rmSync(path.resolve("storage-e2e"), { recursive: true, force: true });
rmSync(path.resolve("tests/e2e/.auth"), { recursive: true, force: true });
console.log(`Prepared ${dbName}`);
