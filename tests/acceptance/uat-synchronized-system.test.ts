import { describe, it, expect, beforeEach } from 'vitest';
import { MilkFlowStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('Acceptance Testing (UAT-Synchronized): Unified Relational Core Architecture', () => {
  let store: MilkFlowStore;

  beforeEach(() => {
    store = resetTestStore();
  });

  it('Test A: Customer to Farmer relationship & signup linkage', () => {
    // 1. A new customer signs up and is assigned to Suresh Patel (farmer_01)
    const { customer, subscription, user } = store.registerCustomer({
      name: 'Meena Kumari',
      phone: '+91 98989 12345',
      address: 'Flat 401, Galaxy Towers, Anand',
      productId: 'prod_cow_01',
      quantity: 1.5,
      deliveryShift: 'MORNING',
      farmerId: 'farmer_01',
      autoApprove: true,
    });

    // Verification 1: Customer Profile and Subscription are explicitly linked to farmer_01
    expect(customer).toBeDefined();
    expect(customer.farmerId).toBe('farmer_01');
    expect(subscription.farmerId).toBe('farmer_01');
    expect(user.role).toBe('CUSTOMER');

    // Verification 2: Farmer Suresh Patel's customer directory includes Meena
    const sureshCustomers = store.getFarmerCustomers('farmer_01');
    const meenaInSuresh = sureshCustomers.find((c) => c.id === customer.id);
    expect(meenaInSuresh).toBeDefined();
    expect(meenaInSuresh?.name).toBe('Meena Kumari');

    // Verification 3: Another farmer's scoped query does NOT leak Meena
    const otherFarmerCustomers = store.getFarmerCustomers('farmer_99_other');
    const meenaInOther = otherFarmerCustomers.find((c) => c.id === customer.id);
    expect(meenaInOther).toBeUndefined();

    // Verification 4: Customer dashboard retrieves the linked farmer and subscription
    const dashboard = store.getCustomerDashboardData(customer.id);
    expect(dashboard).not.toBeNull();
    expect(dashboard?.customer.id).toBe(customer.id);
    expect(dashboard?.farmer.id).toBe('farmer_01');
    expect(dashboard?.subscriptions[0].defaultQuantity).toBe(1.5);
  });

  it('Test B: Vacation Pause request & review lifecycle', () => {
    const customerId = 'cust_ravi';
    const pauseStart = '2026-09-20';
    const pauseEnd = '2026-09-22';

    // Step 1: Ravi requests a vacation pause (server creates a PENDING request)
    const pauseReq = store.createPauseRequest({
      customerId,
      startDate: pauseStart,
      endDate: pauseEnd,
      reason: 'Attending family wedding in Jaipur',
    });

    expect(pauseReq).toBeDefined();
    expect(pauseReq.status).toBe('PENDING');
    expect(pauseReq.customerId).toBe(customerId);
    expect(pauseReq.farmerId).toBe('farmer_01');

    // Step 2: Ravi's customer view shows request as PENDING
    const raviDashboardBefore = store.getCustomerDashboardData(customerId);
    const pendingInRavi = raviDashboardBefore?.pauseRequests.find((p) => p.id === pauseReq.id);
    expect(pendingInRavi).toBeDefined();
    expect(pendingInRavi?.status).toBe('PENDING');

    // Step 3: Before approval, delivery on pause dates is NOT skipped (PENDING invariant)
    const ledgerDayBeforeApproval = store.getOrGenerateDailyLedger('2026-09-21');
    const raviDeliveryBefore = ledgerDayBeforeApproval.find((r) => r.customerId === customerId);
    expect(raviDeliveryBefore?.status).toBe('DELIVERED');
    expect(raviDeliveryBefore?.deliveredQuantity).toBe(1.0);

    // Step 4: Farmer Suresh Patel sees the pending request in Requests Center
    const farmerRequestsBefore = store.getFarmerRequests('farmer_01');
    const pendingInFarmer = farmerRequestsBefore.pauseRequests.find((p) => p.id === pauseReq.id);
    expect(pendingInFarmer).toBeDefined();
    expect(pendingInFarmer?.status).toBe('PENDING');

    // Step 5: Farmer Suresh Patel APPROVES the vacation pause
    const approvedReq = store.reviewPauseRequest({
      requestId: pauseReq.id,
      action: 'APPROVED',
      reviewedBy: 'Suresh Patel (Farmer)',
    });

    expect(approvedReq).not.toBeNull();
    expect(approvedReq?.status).toBe('APPROVED');
    expect(approvedReq?.reviewedBy).toBe('Suresh Patel (Farmer)');

    // Step 6: Ravi's view immediately reflects APPROVED
    const raviDashboardAfter = store.getCustomerDashboardData(customerId);
    const approvedInRavi = raviDashboardAfter?.pauseRequests.find((p) => p.id === pauseReq.id);
    expect(approvedInRavi?.status).toBe('APPROVED');

    // Step 7: Delivery records on pause dates are now SKIPPED with 0L and ₹0 billable
    const ledgerDay1 = store.getOrGenerateDailyLedger('2026-09-20');
    const raviDay1 = ledgerDay1.find((r) => r.customerId === customerId);
    expect(raviDay1?.status).toBe('SKIPPED');
    expect(raviDay1?.deliveredQuantity).toBe(0.0);
    expect(raviDay1?.billableAmount).toBe(0.0);

    const ledgerDay2 = store.getOrGenerateDailyLedger('2026-09-21');
    const raviDay2 = ledgerDay2.find((r) => r.customerId === customerId);
    expect(raviDay2?.status).toBe('SKIPPED');
    expect(raviDay2?.deliveredQuantity).toBe(0.0);
    expect(raviDay2?.billableAmount).toBe(0.0);

    // Step 8: Cryptographic audit log verifies the pause approval
    const auditBlock = store.auditChain.find((b) => b.action === 'VACATION_PAUSE_APPROVED');
    expect(auditBlock).toBeDefined();
    expect(auditBlock?.actor.name).toBe('Suresh Patel (Farmer)');
  });

  it('Test C: Extra Milk Request lifecycle & billing impact', () => {
    const customerId = 'cust_ravi';
    const targetDate = '2026-09-28';

    // Step 1: Ravi requests 2.5 L extra milk for a family gathering
    const extraReq = store.requestExtraMilk({
      customerId,
      date: targetDate,
      requestedQuantity: 2.5,
      reason: 'Guests arriving for dinner party',
    });

    expect(extraReq.status).toBe('PENDING');
    expect(extraReq.requestedQuantity).toBe(2.5);
    expect(extraReq.farmerId).toBe('farmer_01');

    // Step 2: Farmer Suresh sees it in pending requests
    const farmerRequests = store.getFarmerRequests('farmer_01');
    const pendingExtra = farmerRequests.milkRequests.find((m) => m.id === extraReq.id);
    expect(pendingExtra).toBeDefined();
    expect(pendingExtra?.status).toBe('PENDING');

    // Step 3: Farmer Suresh approves the extra milk request
    const approvedExtra = store.reviewExtraMilkRequest({
      requestId: extraReq.id,
      action: 'APPROVED',
      reviewedBy: 'Suresh Patel (Farmer)',
    });

    expect(approvedExtra?.status).toBe('APPROVED');

    // Step 4: Daily delivery record on 2026-09-28 is scheduled and delivered for 2.5 L
    const ledger = store.getOrGenerateDailyLedger(targetDate);
    const raviRecord = ledger.find((r) => r.customerId === customerId);

    expect(raviRecord).toBeDefined();
    expect(raviRecord?.status).toBe('EXTRA');
    expect(raviRecord?.scheduledQuantity).toBe(2.5);
    expect(raviRecord?.deliveredQuantity).toBe(2.5);
    expect(raviRecord?.billableAmount).toBe(2.5 * 50.0); // ₹125.0

    // Step 5: Monthly invoice accurately incorporates the extra milk
    const invoice = store.recalculateMonthlyInvoice(customerId, 9, 2026);
    expect(invoice).not.toBeNull();
    expect(invoice?.totalAmount).toBeGreaterThanOrEqual(125.0);

    // Step 6: Customer portal dashboard shows approved extra milk request
    const custDash = store.getCustomerDashboardData(customerId);
    const approvedInCust = custDash?.milkRequests.find((m) => m.id === extraReq.id);
    expect(approvedInCust?.status).toBe('APPROVED');
  });

  it('Test D: Real-time dispute filing & farmer resolution', () => {
    const customerId = 'cust_anand';
    const date = '2026-09-16';

    // Get Anand's delivery record
    const ledger = store.getOrGenerateDailyLedger(date);
    const anandRecord = ledger.find((r) => r.customerId === customerId)!;
    expect(anandRecord).toBeDefined();

    // Step 1: Anand files a dispute claiming he did not receive 2.0 L milk
    const dispute = store.submitDispute(
      customerId,
      anandRecord.id,
      0.0,
      'DID_NOT_RECEIVE',
      'Milk bottle was missing from doorstep milk bag'
    );

    expect(dispute).toBeDefined();
    expect(dispute?.status).toBe('OPEN');
    expect(dispute?.farmerId).toBe('farmer_01');

    // Step 2: Farmer Suresh's portal shows the open dispute
    const farmerRequests = store.getFarmerRequests('farmer_01');
    const disputeInFarmer = farmerRequests.disputes.find((d) => d.id === dispute!.id);
    expect(disputeInFarmer).toBeDefined();
    expect(disputeInFarmer?.status).toBe('OPEN');

    // Step 3: Farmer Suresh resolves dispute acknowledging customer claim
    const resolution = store.resolveDispute(
      dispute!.id,
      'ACCEPT',
      undefined,
      'Verified delivery route GPS, bottle placed at neighbor door. Adjusted to 0L.',
      'Suresh Patel (Farmer)'
    );

    expect(resolution).not.toBeNull();
    expect(resolution?.dispute.status).toBe('RESOLVED');
    expect(resolution?.dispute.resolutionType).toBe('CUSTOMER_VALID');

    // Step 4: Ledger updates deliveredQuantity to 0.0, billable to ₹0
    const updatedRecord = store.getOrGenerateDailyLedger(date).find((r) => r.customerId === customerId);
    expect(updatedRecord?.deliveredQuantity).toBe(0.0);
    expect(updatedRecord?.billableAmount).toBe(0.0);

    // Step 5: Anand's customer portal view reflects the resolution and updated invoice
    const anandDash = store.getCustomerDashboardData(customerId);
    const resolvedInCust = anandDash?.disputes.find((d) => d.id === dispute!.id);
    expect(resolvedInCust?.status).toBe('RESOLVED');
    expect(resolvedInCust?.resolutionType).toBe('CUSTOMER_VALID');

    // Step 6: Cryptographic audit log written
    const disputeAudit = store.auditChain.find((b) => b.action.startsWith('DISPUTE_RESOLVED'));
    expect(disputeAudit).toBeDefined();
  });

  it('Test E: Real-time payment reflection across both Customer & Farmer portals', () => {
    const customerId = 'cust_ravi';
    const invoice = store.recalculateMonthlyInvoice(customerId, 9, 2026)!;
    expect(invoice).toBeDefined();

    const previousPaid = invoice.paidAmount || 0;
    const paymentAmount = 450.0;
    const txRef = `UPI_TEST_REF_${Date.now()}`;

    // Step 1: Customer Ravi makes a UPI payment
    const paymentResult = store.recordPayment(
      invoice.id,
      paymentAmount,
      'UPI',
      txRef,
      'Ravi Kumar payment via portal'
    );

    expect(paymentResult).not.toBeNull();
    expect(paymentResult?.payment).toBeDefined();
    expect(paymentResult?.payment.status).toBe('SUCCESS');
    expect(paymentResult?.payment.amount).toBe(paymentAmount);
    expect(paymentResult?.payment.farmerId).toBe('farmer_01');
    expect(paymentResult?.isDuplicate).toBe(false);

    // Step 2: Idempotency protection prevents duplicate recording on replay
    const duplicateResult = store.recordPayment(
      invoice.id,
      paymentAmount,
      'UPI',
      txRef,
      'Ravi Kumar duplicate payment replay'
    );
    expect(duplicateResult?.isDuplicate).toBe(true);
    expect(duplicateResult?.payment.id).toBe(paymentResult?.payment.id);

    // Step 3: Customer dashboard immediately reflects updated paid amount and outstanding balance
    const custDash = store.getCustomerDashboardData(customerId);
    const custInvoice = custDash?.invoices.find((i) => i.id === invoice.id);
    expect(custInvoice?.paidAmount).toBe(previousPaid + paymentAmount);
    const expectedOutstanding = Math.max(0, parseFloat((custInvoice!.totalAmount - (previousPaid + paymentAmount)).toFixed(2)));
    expect(custInvoice?.outstandingAmount).toBe(expectedOutstanding);

    // Step 4: Farmer portal invoice view reflects the exact same payment
    const farmerInvoice = store.invoices.find((i) => i.id === invoice.id);
    expect(farmerInvoice?.paidAmount).toBe(previousPaid + paymentAmount);

    // Step 5: Cryptographic audit chain verifies 100% integrity
    const chainVerification = store.verifyAuditChain();
    expect(chainVerification.valid).toBe(true);
    expect(chainVerification.totalBlocks).toBeGreaterThan(0);
  });
});
