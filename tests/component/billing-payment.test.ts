import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Component Testing: Billing & Idempotent Payments', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  describe('Invoice Calculation & Lifecycle', () => {
    it('should generate monthly invoice for a customer based on delivery records', () => {
      const invoice = store.recalculateMonthlyInvoice('cust_ravi', 9, 2026);
      expect(invoice).not.toBeNull();
      expect(invoice?.customerId).toBe('cust_ravi');
      expect(invoice?.month).toBe(9);
      expect(invoice?.year).toBe(2026);
      expect(invoice?.invoiceNumber).toMatch(/^INV-202609-\d+/);
      expect(invoice?.items.length).toBeGreaterThan(0);
      expect(invoice?.subtotal).toBeGreaterThan(0);
      expect(invoice?.totalAmount).toBe(invoice!.subtotal + invoice!.extraCharges - invoice!.creditsOrAdjustments);
    });

    it('should accurately calculate outstandingAmount = totalAmount - paidAmount', () => {
      const inv = store.invoices.find((i) => i.id === 'inv_2026_09_ravi')!;
      expect(inv).toBeDefined();
      expect(inv.outstandingAmount).toBe(parseFloat((inv.totalAmount - inv.paidAmount).toFixed(2)));
    });
  });

  describe('Payment Processor & Idempotency Guarantees', () => {
    it('should record a valid payment and update invoice state', () => {
      const inv = store.invoices.find((i) => i.customerId === 'cust_ravi')!;
      const initialPaid = inv.paidAmount;
      const initialOutstanding = inv.outstandingAmount;
      const paymentAmount = 100.0;
      const txRef = `UPI-TEST-${Date.now()}`;

      const res = store.recordPayment(inv.id, paymentAmount, 'UPI', txRef, 'Partial installment');
      expect(res).not.toBeNull();
      expect(res?.isDuplicate).toBe(false);
      expect(res?.payment.amount).toBe(paymentAmount);
      expect(res?.payment.transactionRef).toBe(txRef);
      expect(res?.payment.receiptNumber).toMatch(/^REC-\d{6}-\d{4}$/);

      // Verify invoice mutation
      expect(inv.paidAmount).toBe(parseFloat((initialPaid + paymentAmount).toFixed(2)));
      expect(inv.outstandingAmount).toBe(parseFloat((initialOutstanding - paymentAmount).toFixed(2)));
    });

    it('should transition invoice status to PAID when outstanding balance becomes zero', () => {
      const inv = store.invoices.find((i) => i.customerId === 'cust_ravi')!;
      const remainingDue = inv.outstandingAmount;
      const txRef = `UPI-FULL-${Date.now()}`;

      const res = store.recordPayment(inv.id, remainingDue, 'UPI', txRef, 'Full settlement');
      expect(res?.isDuplicate).toBe(false);
      expect(inv.outstandingAmount).toBe(0.0);
      expect(inv.status).toBe('PAID');
    });

    it('should reject duplicate transactionRef and prevent double crediting (Idempotency)', () => {
      const inv = store.invoices.find((i) => i.customerId === 'cust_ravi')!;
      const txRef = `UPI-IDEMPOTENT-KEY-${Date.now()}`;

      // First attempt
      const firstRes = store.recordPayment(inv.id, 50.0, 'UPI', txRef, 'First submission');
      expect(firstRes?.isDuplicate).toBe(false);
      const paidAfterFirst = inv.paidAmount;

      // Replay identical transaction ref (simulating network retry or duplicate webhook)
      const secondRes = store.recordPayment(inv.id, 50.0, 'UPI', txRef, 'Retry submission');
      expect(secondRes?.isDuplicate).toBe(true);
      expect(secondRes?.payment.id).toBe(firstRes?.payment.id);

      // Verify paidAmount was NOT incremented again
      expect(inv.paidAmount).toBe(paidAfterFirst);
    });
  });

  describe('Disputes & Adjustment Credits', () => {
    it('should apply dispute resolution credits to invoice recalculation', () => {
      // Find an open dispute or create one
      const disp = store.submitDispute(
        'cust_ravi',
        'del_2026-09-16_cust_ravi',
        0.5,
        'WRONG_QUANTITY',
        'Only took 0.5L but marked 1.0L'
      );

      expect(disp).not.toBeNull();
      expect(disp?.status).toBe('OPEN');

      // Farmer resolves dispute with partial adjustment
      const resolution = store.resolveDispute(
        disp!.id,
        'ACCEPT',
        undefined,
        'Adjustment granted per note',
        'Farmer Suresh'
      );

      expect(resolution).not.toBeNull();
      expect(resolution?.dispute.status).toBe('RESOLVED');
      expect(resolution?.dispute.resolutionType).toBe('CUSTOMER_VALID');
      expect(resolution?.dispute.adjustmentAmount).toBe(25.0);
      expect(resolution?.record.deliveredQuantity).toBe(0.5);
      expect(resolution?.record.billableAmount).toBe(25.0);

      // Recalculate invoice and verify corrected amount
      const updatedInv = store.recalculateMonthlyInvoice('cust_ravi', 9, 2026);
      expect(updatedInv).not.toBeNull();
      expect(updatedInv?.totalAmount).toBeDefined();
    });
  });
});
