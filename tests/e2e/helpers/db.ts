import { PrismaClient } from "../../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { E2E_DATABASE_URL } from "../../../playwright.config";

/** Direct database access for test setup/assertions (never used by the app under test). */
let client: PrismaClient | null = null;

export function db(): PrismaClient {
  if (!client) client = new PrismaClient({ adapter: new PrismaPg({ connectionString: E2E_DATABASE_URL }) });
  return client;
}
