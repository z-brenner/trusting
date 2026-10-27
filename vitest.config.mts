import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/unit/global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://postgres@127.0.0.1:5432/trustcenter_test",
      SESSION_SECRET: "test-session-secret-test-session-secret-test",
      ENCRYPTION_KEY: "11".repeat(32),
      APP_URL: "http://localhost:3000",
      STORAGE_DRIVER: "local",
      LOCAL_STORAGE_PATH: "./storage-test",
    },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
