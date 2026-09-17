import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Acceptance Testing (UAT-04): Month-End Invoicing, UPI Settlement & Replay Protection', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  it('Scenario: Farmer runs month-end billing; Customer settles via UPI; System prevents double-payment on network replay', () => {
    const month = 9;
    const year = 2026;

    // Step 1: Simulate complete monthly cycle (Days 1 to 30) for September
    for (let d = 1; d <= 30; d++) {
      const dayStr = d < 10 ? `0${d}` : `${d}`;
      store.getOrGenerateDailyLedger(`2026-09-${dayStr}`);
    }

    const raviInvoice = store.recalculateMonthlyInvoice('cust_ravi', month, year)!;
    expect(raviInvoice).toBeDefined();
    expect(raviInvoice.invoiceNumber).toMatch(/^INV-202609-\d+/);
    expect(raviInvoice.totalAmount).toBeGreaterThan(1000.0);

    const initialOutstanding = raviInvoice.outstandingAmount;
    expect(initialOutstanding).toBeGreaterThan(0);

    // Step 2: Customer initiates UPI payment for full outstanding amount
    const idempotencyKey = `UPI-UAT-REF-${Date.now()}`;
    const paymentResult = store.recordPayment(
      raviInvoice.id,
      initialOutstanding,
      'UPI',
      idempotencyKey,
      'Settled via PhonePe UPI'
    );

    expect(paymentResult).not.toBeNull();
    expect(paymentResult?.isDuplicate).toBe(false);
    expect(paymentResult?.payment.amount).toBe(initialOutstanding);
    expect(paymentResult?.payment.transactionRef).toBe(idempotencyKey);
    expect(paymentResult?.payment.receiptNumber).toMatch(/^REC-\d{6}-\d{4}$/);

    // Step 3: Invoice transitions to PAID with outstandingAmount = 0
    expect(raviInvoice.outstandingAmount).toBe(0.0);
    expect(raviInvoice.status).toBe('PAID');

    // Step 4: Network glitch causes payment gateway to retry sending the exact same webhook / transaction
    const duplicateSubmission = store.recordPayment(
      raviInvoice.id,
      initialOutstanding,
      'UPI',
      idempotencyKey,
      'Retry attempt'
    );

    expect(duplicateSubmission).not.toBeNull();
    expect(duplicateSubmission?.isDuplicate).toBe(true);
    expect(duplicateSubmission?.payment.id).toBe(paymentResult?.payment.id);

    // Invariant check: paidAmount must NOT be double credited
    expect(raviInvoice.paidAmount).toBe(parseFloat((initialOutstanding + (raviInvoice.totalAmount - initialOutstanding)).toFixed(2)));
    expect(raviInvoice.outstandingAmount).toBe(0.0);

    // Step 5: Cryptographic audit chain registers the legitimate payment event and remains valid
    const auditVerification = store.verifyAuditChain();
    expect(auditVerification.valid).toBe(true);
  });
});
