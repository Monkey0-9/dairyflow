import { describe, it, expect } from 'vitest';
import { assertNoSubscriptionOverlap } from '@/lib/domain/invariants/SubscriptionOverlapInvariant';
import { assertNoPriceOverlap } from '@/lib/domain/invariants/PriceOverlapInvariant';
import { assertDeliveryTransition } from '@/lib/domain/invariants/DeliveryStateInvariant';
import { assertInventoryBalance } from '@/lib/domain/invariants/InventoryBalanceInvariant';
import { assertInvoiceMutationAllowed } from '@/lib/domain/invariants/InvoiceImmutabilityInvariant';
import { reconcileStatement } from '@/lib/domain/accounting/reconciliation';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86400000;

/**
 * Move 6: Property-based testing — thousands of randomized configurations
 * (quantities, dates, adjustments, pause intervals, prices) asserting
 * domain non-violation on valid inputs and rejection on invalid inputs.
 */
describe('Property-based domain invariants', () => {
  it('non-overlapping subscription chains always validate; overlapping always reject', () => {
    const r = rng(20260918);
    for (let i = 0; i < 800; i++) {
      // Build a valid non-overlapping chain of 1-4 versions
      const n = 1 + Math.floor(r() * 4);
      const base = Date.now() + Math.floor(r() * 365 * DAY);
      const chain = Array.from({ length: n }, (_, k) => ({
        id: `v${k}`,
        effectiveFrom: new Date(base + k * 30 * DAY),
        effectiveTo: new Date(base + (k + 1) * 30 * DAY),
      }));
      expect(assertNoSubscriptionOverlap(chain).valid).toBe(true);
      // Inject an overlap: duplicate first interval shifted by 1 day
      const evil = [
        ...chain,
        {
          id: 'evil',
          effectiveFrom: new Date(base + 1 * DAY),
          effectiveTo: new Date(base + 31 * DAY),
        },
      ];
      expect(assertNoSubscriptionOverlap(evil).valid).toBe(false);
    }
  });

  it('non-overlapping price windows validate; negative prices reject', () => {
    const r = rng(777);
    for (let i = 0; i < 800; i++) {
      const n = 1 + Math.floor(r() * 3);
      const base = Date.now() + Math.floor(r() * 200 * DAY);
      const periods = Array.from({ length: n }, (_, k) => ({
        id: `p${k}`,
        effectiveFrom: new Date(base + k * 60 * DAY),
        effectiveTo: new Date(base + (k + 1) * 60 * DAY),
        pricePerUnit: Math.round((20 + r() * 80) * 100) / 100,
      }));
      expect(assertNoPriceOverlap(periods).valid).toBe(true);
      expect(
        assertNoPriceOverlap([{ ...periods[0], pricePerUnit: -Math.abs(periods[0].pricePerUnit) - 1 }])
          .valid,
      ).toBe(false);
    }
  });

  it('randomized inventory splits always reconcile when derived from a fixed total', () => {
    const r = rng(4242);
    for (let i = 0; i < 1000; i++) {
      const opening = Math.round(r() * 50 * 100) / 100;
      const production = Math.round(r() * 100 * 100) / 100;
      const total = opening + production;
      // Random split of total across 4 buckets
      const cuts = [r(), r(), r()].sort((a, b) => a - b);
      const delivered = Math.round(total * cuts[0] * 100) / 100;
      const waste = Math.round(total * (cuts[1] - cuts[0]) * 100) / 100;
      const personal = Math.round(total * (cuts[2] - cuts[1]) * 100) / 100;
      const closing = Math.round((total - delivered - waste - personal) * 100) / 100;
      expect(
        assertInventoryBalance({ openingStock: opening, productionQuantity: production, deliveredQuantity: delivered, wasteQuantity: waste, personalQuantity: personal, closingStock: closing }).valid,
      ).toBe(true);
    }
  });

  it('delivery FSM: EXPECTED ingress always legal; terminal egress always illegal', () => {
    const legal = ['DELIVERED', 'PARTIAL', 'SKIPPED', 'EXTRA', 'NOT_DELIVERED', 'DISPUTED', 'MISSED', 'PAUSED'];
    for (const to of legal) {
      expect(assertDeliveryTransition('EXPECTED', to).valid).toBe(true);
    }
    for (const terminal of ['DELIVERED', 'SKIPPED', 'NOT_DELIVERED', 'MISSED', 'PAUSED']) {
      expect(assertDeliveryTransition(terminal, 'DELIVERED').valid).toBe(false);
      expect(assertDeliveryTransition(terminal, 'EXPECTED').valid).toBe(false);
    }
  });

  it('immutable invoice fields require adjustment notes; randomized statements stay finite', () => {
    const r = rng(999);
    for (let i = 0; i < 500; i++) {
      expect(
        assertInvoiceMutationAllowed({ hasAdjustmentNote: false, attemptedFields: ['total_amount'] }).valid,
      ).toBe(false);
      expect(
        assertInvoiceMutationAllowed({ hasAdjustmentNote: true, attemptedFields: ['total_amount'] }).valid,
      ).toBe(true);
      const s = reconcileStatement({
        openingBalance: Math.round((r() - 0.2) * 5000 * 100) / 100,
        charges: Math.round(r() * 3000 * 100) / 100,
        debits: Math.round(r() * 200 * 100) / 100,
        credits: Math.round(r() * 200 * 100) / 100,
        payments: Math.round(r() * 4000 * 100) / 100,
      });
      expect(Number.isFinite(s.closingBalance)).toBe(true);
    }
  });
});
