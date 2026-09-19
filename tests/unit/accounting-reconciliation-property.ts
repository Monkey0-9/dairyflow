import { describe, it, expect } from 'vitest';
import {
  reconcileStatement,
  reconcileInvoiceLedger,
  verifyLedgerParity,
  round2,
} from '@/lib/domain/accounting/reconciliation';

/** Deterministic PRNG (mulberry32) so the 1000+ permutations are reproducible. */
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

describe('Accounting reconciliation property (1000+ permutations)', () => {
  it('canonical equation holds: Closing = Opening + Charges + Debits - Credits - Payments', () => {
    const r = rng(42);
    for (let i = 0; i < 1200; i++) {
      const opening = round2((r() - 0.2) * 5000);
      const charges = round2(r() * 3000);
      const debits = round2(r() * 500);
      const credits = round2(r() * 500);
      const payments = round2(r() * 4000);
      const { closingBalance } = reconcileStatement({ openingBalance: opening, charges, debits, credits, payments });
      expect(closingBalance).toBe(round2(opening + charges + debits - credits - payments));
      expect(Number.isFinite(closingBalance)).toBe(true);
    }
  });

  it('invoice ledger parity: statement closing == ledger outstanding; payment log == ledger payments', () => {
    const r = rng(1337);
    for (let i = 0; i < 1000; i++) {
      const nItems = 1 + Math.floor(r() * 8);
      const items = Array.from({ length: nItems }, () => ({
        quantity: round2(r() * 5),
        rate: round2(20 + r() * 80),
      }));
      const gross = round2(items.reduce((s, it) => s + it.quantity * it.rate, 0));
      const debits = round2(r() * 300);
      const credits = round2(r() * 300);
      const payments = round2(r() * (gross + debits));
      const opening = round2(r() * 2000);
      const parity = verifyLedgerParity({
        statement: { openingBalance: opening, charges: gross, debits, credits, payments },
        invoiceLedger: { items, debits, credits, payments },
        paymentLogTotal: payments,
      });
      expect(parity.parity).toBe(true);
      expect(parity.paymentDelta).toBe(0);
      // Ledger unit check
      const ledger = reconcileInvoiceLedger({ items, debits, credits, payments });
      expect(ledger.grossCharges).toBe(gross);
      expect(ledger.outstanding).toBe(round2(ledger.netTotal - payments));
    }
  });

  it('rejects negative charges/debits/credits/payments and non-finite inputs', () => {
    expect(() =>
      reconcileStatement({ openingBalance: 0, charges: -1, debits: 0, credits: 0, payments: 0 }),
    ).toThrow();
    expect(() =>
      reconcileStatement({ openingBalance: 0, charges: 0, debits: 0, credits: 0, payments: NaN }),
    ).toThrow();
  });
});
