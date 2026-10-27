export default async function globalTeardown() {
  const mocks = (globalThis as { __mocks?: { stop: () => Promise<void> | void } }).__mocks;
  if (mocks) await mocks.stop();
}
