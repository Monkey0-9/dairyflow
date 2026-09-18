import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCustomersHandler, POST as postCustomersHandler } from '@/app/api/customers/route';
import { POST as postDisputesHandler, PATCH as patchDisputesHandler } from '@/app/api/disputes/route';
import { GET as getVacationsHandler, POST as postVacationsHandler } from '@/app/api/vacations/route';
import { GET as verifyAuditHandler } from '@/app/api/audit/verify/route';
import { resetTestStore } from '../setup';
import { getStore } from '@/lib/store';

describe('System Testing: Customers, Disputes, Vacations & Audit Verification API', () => {
  beforeEach(() => {
    resetTestStore();
  });

  describe('Customers API (/api/customers)', () => {
    it('should list all customers with subscriptions and farmer profile', async () => {
      const req = new NextRequest('http://localhost:3000/api/customers');
      const res = await getCustomersHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.customers)).toBe(true);
      expect(data.customers.length).toBeGreaterThan(0);
      expect(data.farmer).toBeDefined();
    });

    it('should retrieve a specific customer with related data by id', async () => {
      const req = new NextRequest('http://localhost:3000/api/customers?id=cust_ravi');
      const res = await getCustomersHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.customer.id).toBe('cust_ravi');
      expect(data.subscription).toBeDefined();
      expect(Array.isArray(data.invoices)).toBe(true);
      expect(Array.isArray(data.payments)).toBe(true);
    });

    it('should register a new customer via POST', async () => {
      const req = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sunita Sharma',
          phone: '+91 98111 22233',
          address: 'Plot 55, Sector 4',
          productId: 'prod_cow_milk',
          quantity: 1.5,
          deliveryShift: 'MORNING',
        }),
      });

      const res = await postCustomersHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.customer.name).toBe('Sunita Sharma');
      expect(data.customer.customerCode).toMatch(/^MK-\d+/);
      expect(data.customer.qrToken).toBeTruthy();

      const store = getStore();
      const sub = store.subscriptions.find((s) => s.customerId === data.customer.id);
      expect(sub).toBeDefined();
      expect(sub?.defaultQuantity).toBe(1.5);
    });
  });

  describe('Disputes API (/api/disputes)', () => {
    it('should allow customer to file a dispute via POST', async () => {
      const store = getStore();
      const targetRecord = store.getOrGenerateDailyLedger('2026-09-16')[0];

      const req = new NextRequest('http://localhost:3000/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: targetRecord.customerId,
          deliveryRecordId: targetRecord.id,
          claimedQuantity: 0.0,
          reason: 'DID_NOT_RECEIVE',
          customerNote: 'Milk canister was empty this morning',
        }),
      });

      const res = await postDisputesHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.dispute.status).toBe('OPEN');
      expect(data.dispute.claimedQuantity).toBe(0.0);
    });

    it('should allow farmer to resolve a dispute via PATCH', async () => {
      const store = getStore();
      const openDispute = store.disputes.find((d) => d.status === 'OPEN')!;
      expect(openDispute).toBeDefined();

      const patchReq = new NextRequest('http://localhost:3000/api/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: openDispute.id,
          action: 'ACCEPT',
          farmerNote: 'Doorstep check verified - credit applied',
        }),
      });

      const patchRes = await patchDisputesHandler(patchReq);
      const patchData = await patchRes.json();

      expect(patchRes.status).toBe(200);
      expect(patchData.success).toBe(true);
      expect(patchData.dispute.status).toBe('RESOLVED');
      expect(patchData.dispute.resolutionType).toBe('CUSTOMER_VALID');
    });
  });

  describe('Vacations API (/api/vacations)', () => {
    it('should schedule customer vacation pause and retrieve active vacations', async () => {
      const postReq = new NextRequest('http://localhost:3000/api/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PAUSE',
          customerId: 'cust_ravi',
          startDate: '2026-09-24',
          endDate: '2026-09-28',
          reason: 'Visiting hometown festival',
        }),
      });

      const postRes = await postVacationsHandler(postReq);
      const postData = await postRes.json();

      expect(postRes.status).toBe(200);
      expect(postData.success).toBe(true);
      expect(postData.pause.startDate).toBe('2026-09-24');
      expect(postData.pause.status).toBe('ACTIVE');

      // Now query via GET
      const getReq = new NextRequest('http://localhost:3000/api/vacations?customerId=cust_ravi');
      const getRes = await getVacationsHandler(getReq);
      const getData = await getRes.json();

      expect(getRes.status).toBe(200);
      expect(getData.vacationPauses.some((p: { startDate: string }) => p.startDate === '2026-09-24')).toBe(true);
    });
  });

  describe('Cryptographic Audit Verification API (/api/audit/verify)', () => {
    it('should verify the cryptographic SHA-256 hash chain via GET endpoint', async () => {
      const res = await verifyAuditHandler();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.verification.valid).toBe(true);
      expect(data.verification.algorithm).toBe('SHA-256');
      expect(data.verification.totalBlocks).toBeGreaterThan(0);
      expect(data.verification.genesisBlock.hash).toHaveLength(64);
      expect(data.verification.headBlock.hash).toHaveLength(64);
    });
  });
});
