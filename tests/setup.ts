import { beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';

// Helper function to reset store before tests
export function resetTestStore(): MilkFlowStore {
  const store = new MilkFlowStore();
  global.__milkFlowStore = store;
  return store;
}

beforeEach(() => {
  // Guarantee clean isolated state for every test
  resetTestStore();
});
