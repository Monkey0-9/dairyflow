import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Component Testing: Cryptographic SHA-256 Audit Trail', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  it('should initialize with a non-empty audit chain from demo seed', () => {
    expect(store.auditChain.length).toBeGreaterThan(0);
    const genesis = store.auditChain[0];
    expect(genesis.blockIndex).toBe(0);
    expect(genesis.previousHash).toBe('0000000000000000000000000000000000000000000000000000000000000000');
    expect(genesis.currentHash).toHaveLength(64); // SHA-256 hex length
  });

  it('should maintain continuous cryptographic hash links across all blocks', () => {
    for (let i = 1; i < store.auditChain.length; i++) {
      const prevBlock = store.auditChain[i - 1];
      const currentBlock = store.auditChain[i];

      expect(currentBlock.blockIndex).toBe(i);
      expect(currentBlock.previousHash).toBe(prevBlock.currentHash);
    }
  });

  it('should verify uncorrupted audit chain with valid = true', () => {
    const result = store.verifyAuditChain();
    expect(result.valid).toBe(true);
    expect(result.totalBlocks).toBe(store.auditChain.length);
    expect(result.tamperedBlockIndex).toBeUndefined();
  });

  it('should append a new cryptographic block when an action occurs', () => {
    const initialLength = store.auditChain.length;
    const lastHash = store.auditChain[initialLength - 1].currentHash;

    const newBlock = store.appendCryptographicAudit({
      entityType: 'DELIVERY_RECORD',
      entityId: 'del_test_999',
      action: 'DELIVERY_CONFIRMED',
      actor: { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' },
      beforeState: { status: 'EXPECTED' },
      afterState: { status: 'DELIVERED', quantity: 2.0 },
      reason: 'Standard morning delivery',
    });

    expect(store.auditChain.length).toBe(initialLength + 1);
    expect(newBlock.blockIndex).toBe(initialLength);
    expect(newBlock.previousHash).toBe(lastHash);
    expect(newBlock.currentHash).toHaveLength(64);

    // Chain verification should still pass
    const verification = store.verifyAuditChain();
    expect(verification.valid).toBe(true);
  });

  it('should immediately detect tampering if block data/payload is modified', () => {
    // Pick an existing block in the middle of the chain
    const targetBlockIndex = Math.floor(store.auditChain.length / 2);
    const originalQuantity = store.auditChain[targetBlockIndex].afterState.deliveredQuantity;

    // Malicious actor modifies deliveredQuantity in memory
    store.auditChain[targetBlockIndex].afterState.deliveredQuantity = 9999;

    const verification = store.verifyAuditChain();
    expect(verification.valid).toBe(false);
    expect(verification.tamperedBlockIndex).toBe(targetBlockIndex);
    expect(verification.errorReason).toContain(`Block #${targetBlockIndex} data has been altered`);

    // Restore state
    store.auditChain[targetBlockIndex].afterState.deliveredQuantity = originalQuantity;
  });

  it('should detect tampering if a block hash is altered without recalculating downstream blocks', () => {
    const targetBlockIndex = 1;
    const originalHash = store.auditChain[targetBlockIndex].currentHash;

    // Malicious actor replaces hash with fake hash
    store.auditChain[targetBlockIndex].currentHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    const verification = store.verifyAuditChain();
    expect(verification.valid).toBe(false);
    // Next block should flag broken previousHash link or hash mismatch
    expect(verification.tamperedBlockIndex).toBeDefined();

    // Restore state
    store.auditChain[targetBlockIndex].currentHash = originalHash;
  });
});
