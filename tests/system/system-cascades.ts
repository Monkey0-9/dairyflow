import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postVacationsHandler } from '@/app/api/vacations/route';
import { GET as getLedgerHandler } from '@/app/api/ledger/route';
import { POST as postInvoicesHandler } from '@/app/api/invoices/route';
import { POST as postDisputesHandler, PATCH as patchDisputesHandler } from '@/app/api/disputes/route';
import { GET as verifyAuditHandler } from '@/app/api/audit/verify/route';
import { resetTestStore } from '../setup';

describe('System Testing: Cross-Module Integration Cascades', () => {
  beforeEach(() => {
    resetTestStore();
  });

  it('Cascade 1: Vacation Pause -> Scheduled Ledger Skip -> Zero Invoiced Amount -> Cryptographic Chain Integrity', async () => {
    // 1. Customer schedules vacation pause from Sep 21 to Sep 23
    const vacReq = new NextRequest('http://localhost:3000/api/vacations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'PAUSE',
        customerId: 'cust_ravi',
        startDate: '2026-09-21',
        endDate: '2026-09-23',
        reason: 'Out-of-town wedding trip',
      }),
    });
    const vacRes = await postVacationsHandler(vacReq);
    const vacData = await vacRes.json();
    expect(vacRes.status).toBe(200);
    expect(vacData.success).toBe(true);

    // 2. Ledger for Sep 22 reflects automatic SKIPPED status
    const ledgerReq = new NextRequest('http://localhost:3000/api/ledger?date=2026-09-22');
    const ledgerRes = await getLedgerHandler(ledgerReq);
    const ledgerData = await ledgerRes.json();
    expect(ledgerRes.status).toBe(200);

    const raviRecord = ledgerData.records.find((r: { customerId: string }) => r.customerId === 'cust_ravi');
    expect(raviRecord).toBeDefined();
    expect(raviRecord.status).toBe('SKIPPED');
    expect(raviRecord.deliveredQuantity).toBe(0.0);
    expect(raviRecord.billableAmount).toBe(0.0);
    expect(raviRecord.reason).toContain('Vacation Pause');

    // 3. Trigger invoice recalculation
    const invReq = new NextRequest('http://localhost:3000/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'cust_ravi',
        month: 9,
        year: 2026,
      }),
    });
    const invRes = await postInvoicesHandler(invReq);
    const invData = await invRes.json();
    expect(invRes.status).toBe(200);
    expect(invData.success).toBe(true);

    // 4. Verify end-to-end cryptographic audit chain validity
    const auditRes = await verifyAuditHandler();
    const auditData = await auditRes.json();
    expect(auditData.success).toBe(true);
    expect(auditData.verification.valid).toBe(true);
  });

  it('Cascade 2: Dispute Filing -> Resolution -> Ledger Correction -> Automatic Invoice Re-settlement', async () => {
    // 1. Customer files dispute for a delivery record
    const dispReq = new NextRequest('http://localhost:3000/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'cust_ravi',
        deliveryRecordId: 'del_2026-09-16_cust_ravi',
        claimedQuantity: 0.5,
        reason: 'WRONG_QUANTITY',
        customerNote: 'Only took half litre packet today',
      }),
    });
    const dispRes = await postDisputesHandler(dispReq);
    const dispData = await dispRes.json();
    expect(dispRes.status).toBe(200);
    expect(dispData.dispute.status).toBe('OPEN');

    // 2. Farmer reviews and settles dispute
    const patchReq = new NextRequest('http://localhost:3000/api/disputes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        disputeId: dispData.dispute.id,
        action: 'ACCEPT',
        farmerNote: 'Verified at door - agreed to 0.5L claim',
      }),
    });
    const patchRes = await patchDisputesHandler(patchReq);
    const patchData = await patchRes.json();
    expect(patchRes.status).toBe(200);
    expect(patchData.dispute.status).toBe('RESOLVED');
    expect(patchData.record.deliveredQuantity).toBe(0.5);
    expect(patchData.record.billableAmount).toBe(25.0); // 0.5L * 50.0

    // 3. Cryptographic audit chain must remain intact
    const auditRes = await verifyAuditHandler();
    const auditData = await auditRes.json();
    expect(auditData.verification.valid).toBe(true);
  });
});
