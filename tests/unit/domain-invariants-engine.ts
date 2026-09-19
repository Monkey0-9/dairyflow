import { describe, it, expect } from 'vitest';
import {
  runInvariants,
  runAllInvariants,
  assertNoSubscriptionOverlap,
  assertNoPriceOverlap,
  assertDeliveryTransition,
  assertDayNotClosed,
  assertMonthNotClosed,
  assertInvoiceMutationAllowed,
  assertTransactionRefValid,
  assertInventoryBalance,
  assertAuditContinuity,
  computeAuditHash,
} from '@/lib/domain/invariants/index';

/**
 * Invariant Engine tests: unified runner over every domain law.
 * Pure (DB-independent) except the two *Db closings checks, which skip without Neon.
 */
describe('Invariant engine: unified runner', () => {
  it('passes a fully valid bundle and short-circuits on first failure', async () => {
    const ok = await runInvariants([
      () => assertNoSubscriptionOverlap([{ effectiveFrom: '2026-01-01', effectiveTo: '2026-02-01' }]),
      () => assertDeliveryTransition('EXPECTED', 'DELIVERED'),
      () => assertDayNotClosed('OPEN'),
      () => assertTransactionRefValid('TXN_OK_1'),
    ]);
    expect(ok.valid).toBe(true);

    const bad = await runInvariants([
      () => assertDeliveryTransition('EXPECTED', 'DELIVERED'),
      () => assertDeliveryTransition('DELIVERED', 'EXPECTED'), // illegal
      () => assertDayNotClosed('OPEN'), // must never run
    ]);
    expect(bad.valid).toBe(false);
    expect(bad.code).toBe('ILLEGAL_DELIVERY_TRANSITION');
  });

  it('collects all results for audit reporting', async () => {
    const { valid, results } = await runAllInvariants([
      () => assertMonthNotClosed('FINALIZED'),
      () => assertInvoiceMutationAllowed({ hasAdjustmentNote: false, attemptedFields: ['total_amount'] }),
      () => assertInventoryBalance({ openingStock: 10, productionQuantity: 90, deliveredQuantity: 80, wasteQuantity: 5, personalQuantity: 5, closingStock: 10 }),
    ]);
    expect(valid).toBe(false);
    expect(results).toHaveLength(3);
    expect(results[0].code).toBe('MONTH_CLOSED');
    expect(results[1].code).toBe('INVOICE_IMMUTABLE');
    expect(results[2].valid).toBe(true);
  });

  it('validates every invariant code path end to end', async () => {
    expect(assertNoPriceOverlap([{ effectiveFrom: '2026-01-01', pricePerUnit: 60 }]).valid).toBe(true);
    expect(assertTransactionRefValid('').valid).toBe(false);
    expect(
      assertInventoryBalance({ openingStock: 0, productionQuantity: 10, deliveredQuantity: 5, wasteQuantity: 0, personalQuantity: 0, closingStock: 4 }).code,
    ).toBe('INVENTORY_IMBALANCE');

    // Audit chain: build 3 valid blocks then tamper
    const mk = (index: number, prev: string, action: string) => {
      const b = { index, timestamp: '2026-09-18T00:00:00.000Z', actorId: 'u1', actorRole: 'FARMER', entityType: 'invoice', entityId: 'INV_1', action, beforeState: null as string | null, afterState: '{}', previousHash: prev };
      return { ...b, currentHash: computeAuditHash(b) };
    };
    const genesis = 'GENESIS';
    const b0 = mk(0, genesis, 'create');
    const b1 = mk(1, b0.currentHash, 'pay');
    const b2 = mk(2, b1.currentHash, 'close');
    expect(assertAuditContinuity([b0, b1, b2]).valid).toBe(true);
    expect(assertAuditContinuity([{ ...b2, currentHash: 'tampered' }]).valid).toBe(false);
  });

  it('DB-backed day/month closing checks (skip without DB)', async () => {
    const { testConnection } = await import('@/lib/db');
    let alive = false;
    try {
      alive = await testConnection();
    } catch {
      alive = false;
    }
    if (!alive) return;
    const { assertDayNotClosedDb, assertMonthNotClosedDb } = await import('@/lib/domain/invariants/index');
    const d = await assertDayNotClosedDb({ farmerId: 'F_NOPE', date: '2099-01-01' });
    expect(d.valid).toBe(true);
    const m = await assertMonthNotClosedDb({ farmerId: 'F_NOPE', month: 1, year: 2099 });
    expect(m.valid).toBe(true);
  });
});
