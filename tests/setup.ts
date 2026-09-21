import { beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';

// Helper function to reset store before tests
export function resetTestStore(): MilkFlowStore {
  const store = new MilkFlowStore();
  global.__milkFlowStore = store;
  return store;
}

// SRS §21 / App. C: suites that write to live PostgreSQL only run when
// explicitly enabled. Default `npm run test` never touches the database,
// so routine test runs cannot pollute production data.
// Full live-DB run: LIVE_DB_TESTS=true TEST_DATABASE_URL=<test-db> npm run test
export const LIVE_DB_TESTS_ENABLED = process.env.LIVE_DB_TESTS === 'true';

beforeEach(() => {
  // Guarantee clean isolated state for every test
  resetTestStore();
});
