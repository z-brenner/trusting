import { execSync } from "node:child_process";

const TEST_DB = "postgresql://postgres@127.0.0.1:5432/trustcenter_test";

/** Ensure the unit-test database exists and is migrated before DB-backed tests run. */
export default function setup() {
  try {
    execSync(`psql "postgresql://postgres@127.0.0.1:5432/postgres" -tc "SELECT 1 FROM pg_database WHERE datname='trustcenter_test'" | grep -q 1 || psql "postgresql://postgres@127.0.0.1:5432/postgres" -c "CREATE DATABASE trustcenter_test"`, { stdio: "pipe", shell: "/bin/bash" });
    execSync("pnpm prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? TEST_DB } });
  } catch (err) {
    console.warn("Could not prepare the unit-test database; DB-backed tests will fail.", (err as Error).message);
  }
}
