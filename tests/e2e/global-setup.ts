import { MOCK_GOOGLE_PORT, MOCK_MICROSOFT_PORT } from "../../playwright.config";

/** Starts the OAuth mock providers used by the integration tests. */
export default async function globalSetup() {
  const { startMockProviders } = await import("../mocks/oauth-mock-server");
  const mocks = await startMockProviders({ googlePort: MOCK_GOOGLE_PORT, microsoftPort: MOCK_MICROSOFT_PORT });
  (globalThis as { __mocks?: { stop: () => Promise<void> | void } }).__mocks = mocks;
}
