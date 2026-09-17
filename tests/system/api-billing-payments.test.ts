import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { GET as getInvoicesHandler, POST as postInvoicesHandler } from '@/app/api/invoices/route';
import { POST as postPaymentsHandler } from '@/app/api/payments/route';
import { POST as postWebhookHandler } from '@/app/api/webhook/payment/route';
import { getStore } from '@/lib/store';
import { resetTestStore } from '../setup';

describe('System Testing: Invoices, Payments & Webhooks API', () => {
  beforeEach(() => {
    resetTestStore();
  });

  describe('Invoices API (/api/invoices)', () => {
    it('should retrieve invoices and summary for September 2026', async () => {
      const req = new NextRequest('http://localhost:3000/api/invoices?month=9&year=2026');
      const res = await getInvoicesHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.invoices)).toBe(true);
      expect(data.invoices.length).toBeGreaterThan(0);

      expect(data.summary).toBeDefined();
      expect(data.summary.totalBilled).toBeGreaterThan(0);
      expect(typeof data.summary.totalCollected).toBe('number');
      expect(typeof data.summary.totalOutstanding).toBe('number');
    });

    it('should filter invoices by customerId', async () => {
      const req = new NextRequest('http://localhost:3000/api/invoices?customerId=cust_ravi');
      const res = await getInvoicesHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      data.invoices.forEach((inv: { customerId: string }) => {
        expect(inv.customerId).toBe('cust_ravi');
      });
    });

    it('should trigger invoice recalculation on POST', async () => {
      const req = new NextRequest('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cust_ravi',
          month: 9,
          year: 2026,
        }),
      });

      const res = await postInvoicesHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.invoice).toBeDefined();
      expect(data.invoice.customerId).toBe('cust_ravi');
    });
  });

  describe('Payments API (/api/payments)', () => {
    it('should record payment and update invoice state', async () => {
      const store = getStore();
      const inv = store.invoices[0];
      const initialOutstanding = inv.outstandingAmount;

      const req = new NextRequest('http://localhost:3000/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: inv.id,
          amount: 150.0,
          paymentMethod: 'UPI',
          transactionRef: `UPI-SYS-TEST-${Date.now()}`,
          note: 'Direct UPI transfer',
        }),
      });

      const res = await postPaymentsHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.payment.amount).toBe(150.0);
      expect(data.payment.receiptNumber).toBeTruthy();
      expect(inv.outstandingAmount).toBe(parseFloat((initialOutstanding - 150.0).toFixed(2)));
    });

    it('should return 400 when required fields are missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: 'inv_ravi',
          // amount missing
        }),
      });

      const res = await postPaymentsHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('Payment Webhook with HMAC & Idempotency (/api/webhook/payment)', () => {
    it('should process new webhook payment event successfully', async () => {
      const store = getStore();
      const inv = store.invoices[0];
      const txRef = `UPI-HOOK-TX-${Date.now()}`;

      const payload = {
        event: 'payment.captured',
        invoiceId: inv.id,
        amount: 200.0,
        transactionRef: txRef,
        paymentMethod: 'UPI',
        note: 'UPI QR scan instant confirmation',
      };

      const req = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await postWebhookHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('PROCESSED');
      expect(data.payment.transactionRef).toBe(txRef);
    });

    it('should handle duplicate webhook safely without double processing (Idempotency)', async () => {
      const store = getStore();
      const inv = store.invoices[0];
      const txRef = `UPI-REPLAY-${Date.now()}`;

      const payload = {
        event: 'payment.captured',
        invoiceId: inv.id,
        amount: 75.0,
        transactionRef: txRef,
        paymentMethod: 'UPI',
      };

      // Send first time
      const req1 = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res1 = await postWebhookHandler(req1);
      const data1 = await res1.json();
      expect(data1.status).toBe('PROCESSED');

      // Send duplicate second time (e.g. webhook retry)
      const req2 = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const res2 = await postWebhookHandler(req2);
      const data2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.status).toBe('ALREADY_PROCESSED');
      expect(data2.message).toContain('already processed');
    });

    it('should reject requests with invalid HMAC signatures with 401', async () => {
      const payload = JSON.stringify({
        invoiceId: 'inv_any',
        amount: 100,
        transactionRef: 'tx_fail',
      });

      const req = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'invalid_forged_signature_hash',
        },
        body: payload,
      });

      const res = await postWebhookHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('HMAC signature');
    });
  });
});
