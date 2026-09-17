import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Acceptance Testing (UAT-05): Day Closing, Immutability Locking & Cryptographic Tamper Evidence', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  it('Scenario: Farmer Suresh finalizes daily inventory closing; records become immutable; cryptographic audit detects any retrospective tampering', () => {
    const today = '2026-09-17';
    const dayRecords = store.getOrGenerateDailyLedger(today);
    let expectedDeliveredTotal = 0;
    dayRecords.forEach((r) => {
      expectedDeliveredTotal += r.deliveredQuantity;
    });

    // Step 1: Farmer inputs milk production and closing tally
    const reconciliation = store.closeDay(
      today,
      {
        cowMilkProduced: 100.0,
        buffaloMilkProduced: 50.0,
        a2MilkProduced: 10.0,
        wasteOrSpillage: 2.0,
        personalConsumption: 1.0,
        remainingStock: parseFloat((160.0 - (expectedDeliveredTotal + 3.0)).toFixed(1)),
      },
      { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
    );

    expect(reconciliation).toBeDefined();
    expect(reconciliation.date).toBe(today);
    expect(reconciliation.totalProduced).toBe(160.0);
    expect(reconciliation.status).toBe('BALANCED');

    // Step 2: Date lock status is FINALIZED and all delivery records are locked
    expect(store.dayLockStatusMap.get(today)).toBe('FINALIZED');
    const lockedRecords = store.getOrGenerateDailyLedger(today);
    lockedRecords.forEach((r) => {
      expect(r.isLocked).toBe(true);
    });

    // Step 3: Attempting to modify a delivery record without adjustment authorization is strictly rejected
    const targetRecord = lockedRecords[0];
    const unauthorizedUpdate = store.updateDeliveryRecord(
      targetRecord.id,
      { deliveredQuantity: 99.0 },
      { userId: 'user_farmer', name: 'Farmer Suresh', role: 'FARMER' }
    );

    expect(unauthorizedUpdate.record).toBeNull();
    expect(unauthorizedUpdate.error).toContain('FINALIZED');

    // Step 4: Auditor executes full cryptographic SHA-256 chain verification
    const verification = store.verifyAuditChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalBlocks).toBeGreaterThanOrEqual(1);
    expect(verification.latestHash).toHaveLength(64);

    // Step 5: Threat simulation - Malicious database tampering
    // Suppose an adversary tampers with an older delivery block to falsify milk quantity
    const tamperedIndex = Math.min(3, store.auditChain.length - 1);
    const originalDeliveredQty = store.auditChain[tamperedIndex].afterState.deliveredQuantity;
    store.auditChain[tamperedIndex].afterState.deliveredQuantity = 999;

    // Cryptographic verification must immediately catch the attack
    const postTamperCheck = store.verifyAuditChain();
    expect(postTamperCheck.valid).toBe(false);
    expect(postTamperCheck.tamperedBlockIndex).toBe(tamperedIndex);
    expect(postTamperCheck.errorReason).toContain('Hash mismatch');

    // Restore integrity
    store.auditChain[tamperedIndex].afterState.deliveredQuantity = originalDeliveredQty;
    expect(store.verifyAuditChain().valid).toBe(true);
  });
});
