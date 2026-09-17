import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Acceptance Testing (UAT-03): Delivery Quantity Dispute & Credit Settlement', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  it('Scenario: Customer files delivery quantity dispute; Farmer reviews and settles claim with ledger correction and invoice credit', () => {
    const customerId = 'cust_anand';
    const date = '2026-09-16';

    // Step 1: Delivery record originally marked 2.0L A2 Milk (₹140)
    const originalRecord = store.deliveryRecords.get(`del_${date}_${customerId}`)!;
    expect(originalRecord).toBeDefined();
    const recordedQty = originalRecord.deliveredQuantity;
    const pricePerUnit = originalRecord.pricePerUnit;

    // Step 2: Customer notices dispute: only 1.0L was received in canister
    const dispute = store.submitDispute(
      customerId,
      originalRecord.id,
      1.0, // claimed 1.0L instead of 2.0L
      'WRONG_QUANTITY',
      'Only one bottle was left at doorstep, not two'
    );

    expect(dispute).not.toBeNull();
    expect(dispute?.status).toBe('OPEN');
    expect(dispute?.claimedQuantity).toBe(1.0);
    expect(dispute?.customerNote).toContain('Only one bottle');

    // Step 3: Farmer Suresh inspects open claims in dispute resolution dashboard
    const openClaims = store.disputes.filter((d) => d.status === 'OPEN');
    expect(openClaims.some((d) => d.id === dispute!.id)).toBe(true);

    // Step 4: Farmer checks delivery notes, accepts customer claim, and grants credit
    const resolution = store.resolveDispute(
      dispute!.id,
      'ACCEPT',
      undefined,
      'Doorstep bottle verification confirmed 1 bottle delivered. Settled at 1.0L.',
      'Suresh Patel (Farmer)'
    );

    expect(resolution).not.toBeNull();
    expect(resolution?.dispute.status).toBe('RESOLVED');
    expect(resolution?.dispute.resolutionType).toBe('CUSTOMER_VALID');
    expect(resolution?.dispute.adjustmentAmount).toBe((recordedQty - 1.0) * pricePerUnit);

    // Step 5: Ledger record reflects corrected delivered quantity and reduced billable amount
    expect(resolution?.record.deliveredQuantity).toBe(1.0);
    expect(resolution?.record.billableAmount).toBe(1.0 * pricePerUnit);
    expect(resolution?.record.hasDispute).toBe(false);

    // Step 6: Month-end invoice for Anand automatically recalculates with corrected total
    const invoice = store.recalculateMonthlyInvoice(customerId, 9, 2026);
    expect(invoice).not.toBeNull();

    // Step 7: Cryptographic audit chain verifies 100% integrity following dispute settlement
    const auditStatus = store.verifyAuditChain();
    expect(auditStatus.valid).toBe(true);
  });
});
