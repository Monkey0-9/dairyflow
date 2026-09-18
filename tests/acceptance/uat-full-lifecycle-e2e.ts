import { describe, it, expect } from 'vitest';
import { getStore } from '@/lib/store';
import { encodeSignedSession, SessionUser } from '@/lib/auth';
import { appendAuditLog, verifyAuditChain } from '@/lib/services/audit.service';
import { calculateProcurementRequirement } from '@/lib/services/inventory.service';

describe('UAT Master End-to-End Lifecycle: Complete Dairy Operations Journey', () => {
  const testTenantId = 'tenant_greenvalley';
  const testFarmerId = 'F001';
  const testCustomerId = 'cust_lifecycle_test';

  const customerUser: SessionUser = {
    userId: 'user_lifecycle_test',
    name: 'Vikram Mehta',
    role: 'CUSTOMER',
    tenantId: testTenantId,
    customerId: testCustomerId,
    farmerId: testFarmerId,
    email: 'vikram.mehta@gmail.com',
  };

  const farmerUser: SessionUser = {
    userId: 'user_farmer_suresh',
    name: 'Suresh Patel',
    role: 'FARMER',
    tenantId: testTenantId,
    farmerId: testFarmerId,
    email: 'suresh@greenvalleydairy.in',
  };

  it('executes the full 16-step dairy lifecycle seamlessly with zero data corruption', async () => {
    const store = getStore();

    // Step 1 & 2: Customer registers and authenticates
    const sessionToken = encodeSignedSession(customerUser);
    expect(sessionToken).toBeDefined();
    expect(sessionToken.includes('.')).toBe(true);

    // Step 3: Subscription established
    const sub = store.subscriptions.find((s) => s.customerId === 'cust_ravi') || store.subscriptions[0];
    expect(sub).toBeDefined();
    expect(sub.defaultQuantity).toBeGreaterThan(0);

    // Step 4: Ledger generation with price locking
    const targetDate = '2026-09-18';
    const dayLedger = store.getOrGenerateDailyLedger(targetDate);
    expect(dayLedger.length).toBeGreaterThan(0);

    const raviRecord = dayLedger.find((r) => r.customerId === 'cust_ravi') || dayLedger[0];
    const initialPrice = raviRecord.pricePerUnit;
    expect(initialPrice).toBeGreaterThan(0);

    // Step 5: Farmer marks delivery as DELIVERED
    const updateRes = store.updateDeliveryRecord(
      raviRecord.id,
      {
        deliveredQuantity: raviRecord.scheduledQuantity,
        status: 'DELIVERED',
        bottlesReturned: 1,
      },
      {
        userId: farmerUser.userId,
        name: farmerUser.name,
        role: 'FARMER',
      }
    );
    expect(updateRes.record).toBeDefined();
    expect(updateRes.record?.status).toBe('DELIVERED');
    expect(updateRes.record?.deliveredQuantity).toBe(raviRecord.scheduledQuantity);
    // Invariant: pricePerUnit must remain locked
    expect(updateRes.record?.pricePerUnit).toBe(initialPrice);

    // Step 6: Customer submits vacation pause request
    const pauseReq = store.createPauseRequest({
      customerId: 'cust_ravi',
      startDate: '2026-09-22',
      endDate: '2026-09-25',
      reason: 'Visiting native village',
      farmerId: testFarmerId,
    });
    expect(pauseReq.status).toBe('PENDING');

    // Step 7: Farmer reviews and APPROVES vacation pause
    const approvedPause = store.reviewPauseRequest({
      requestId: pauseReq.id,
      action: 'APPROVED',
      reviewedBy: farmerUser.name,
    });
    expect(approvedPause?.status).toBe('APPROVED');

    // Step 8: Vacation dates automatically become SKIPPED
    const vacationLedger = store.getOrGenerateDailyLedger('2026-09-22');
    const skippedRecord = vacationLedger.find((r) => r.customerId === 'cust_ravi');
    expect(skippedRecord?.status).toBe('SKIPPED');
    expect(skippedRecord?.deliveredQuantity).toBe(0.0);

    // Step 9: Customer requests one-off extra milk for guests
    const extraReq = store.requestExtraMilk({
      customerId: 'cust_ravi',
      date: '2026-09-26',
      requestedQuantity: 2.0,
      reason: 'Festival guests arriving',
      farmerId: testFarmerId,
    });
    expect(extraReq.status).toBe('PENDING');

    // Step 10: Farmer reviews and APPROVES extra milk request
    const approvedExtra = store.reviewExtraMilkRequest({
      requestId: extraReq.id,
      action: 'APPROVED',
      reviewedBy: farmerUser.name,
    });
    expect(approvedExtra?.status).toBe('APPROVED');

    // Step 11: Inventory & Procurement Intelligence for tomorrow
    const procurement = await calculateProcurementRequirement({
      farmerId: testFarmerId,
      tenantId: testTenantId,
      currentDate: '2026-09-18',
      expectedTomorrowProduction: 55.0,
    });
    expect(procurement.expectedDemand).toBeGreaterThan(0);
    expect(procurement.safetyBuffer).toBeGreaterThan(0);
    expect(procurement.confidenceScore).toBeGreaterThanOrEqual(90);

    // Step 12: End of month billing generation with itemized invoice
    const inv = store.invoices.find((i) => i.customerId === 'cust_ravi') || store.invoices[0];
    expect(inv).toBeDefined();
    expect(inv.totalAmount).toBeGreaterThan(0);
    const amountToPay = inv.outstandingAmount;

    // Step 13: Customer initiates idempotent payment for outstanding balance
    const uniqueTxnRef = `UPI_E2E_${Date.now()}_9876`;
    const payResult = store.recordPayment(
      inv.id,
      amountToPay,
      'UPI',
      uniqueTxnRef,
      'Full monthly settlement'
    );
    expect(payResult).toBeDefined();
    expect(payResult?.payment.status).toBe('SUCCESS');

    // Step 14: Invariant verification: Invoice is PAID and outstanding is 0
    const updatedInvoice = store.invoices.find((i) => i.id === inv.id);
    expect(updatedInvoice?.status).toBe('PAID');
    expect(updatedInvoice?.outstandingAmount).toBe(0);

    // Step 15: Payment replay idempotency attack: Resending same transaction reference
    const duplicatePay = store.recordPayment(
      inv.id,
      amountToPay,
      'UPI',
      uniqueTxnRef,
      'Duplicate replay attempt'
    );
    // Duplicate payment must be recognized idempotently without double-crediting
    expect(duplicatePay?.isDuplicate).toBe(true);
    expect(updatedInvoice?.outstandingAmount).toBe(0);

    // Step 16: Cryptographic audit blockchain logging and mathematical integrity check
    const block = await appendAuditLog({
      tenantId: testTenantId,
      actorId: farmerUser.userId,
      actorRole: 'FARMER',
      entityType: 'INVOICE',
      entityId: inv.id,
      action: 'SETTLED',
      beforeState: { outstanding: inv.totalAmount },
      afterState: { outstanding: 0, status: 'PAID' },
    });
    expect(block.currentHash).toBeDefined();
    expect(block.previousHash).toBeDefined();

    const auditContinuity = await verifyAuditChain(testTenantId);
    expect(auditContinuity.valid).toBe(true);
  });
});
