import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getQrHandler, POST as postQrHandler } from '@/app/api/qr/route';
import { GET as getAttentionHandler } from '@/app/api/farmer/attention/route';
import { GET as getConsumptionHandler } from '@/app/api/analytics/consumption/route';
import { checkRateLimit, resetRateLimit } from '@/lib/security/rate-limiter';
import { encodeSignedSession, SessionUser } from '@/lib/auth';
import { resetTestStore } from '../setup';
import { getStore } from '@/lib/store';

describe('System Testing: QR Delivery, Attention Center & Consumption Analytics', () => {
  const farmerUser: SessionUser = {
    userId: 'user_farmer',
    name: 'Suresh Patel',
    role: 'FARMER',
    tenantId: 'tenant_greenvalley',
    farmerId: 'farmer_01',
  };

  const customerUser: SessionUser = {
    userId: 'user_ravi',
    name: 'Ravi Kumar',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_ravi',
    farmerId: 'farmer_01',
  };

  beforeEach(() => {
    resetTestStore();
  });

  describe('Phase 16: QR Delivery Engine', () => {
    it('should lookup active customer via valid QR token', async () => {
      const store = getStore();
      const customer = store.customers[0];
      const token = customer.qrToken;

      const sessionToken = encodeSignedSession(farmerUser);
      const req = new NextRequest(`http://localhost:3000/api/qr?token=${token}`, {
        headers: {
          authorization: `Bearer ${sessionToken}`,
        },
      });

      const res = await getQrHandler(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.customer.customerId).toBe(customer.id);
      expect(body.customer.token).toBe(token);
    });

    it('should confirm delivery via QR scan and update ledger', async () => {
      const store = getStore();
      const customer = store.customers[0];
      const token = customer.qrToken;
      const today = '2026-09-18';

      const sessionToken = encodeSignedSession(farmerUser);
      const req = new NextRequest('http://localhost:3000/api/qr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: 'scan',
          token,
          date: today,
          quantity: 2.0,
          bottlesReturned: 2,
        }),
      });

      const res = await postQrHandler(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.deliveredQuantity).toBe(2.0);
    });

    it('should reject unauthorized customer from confirming delivery via QR scan', async () => {
      const store = getStore();
      const customer = store.customers[0];
      const token = customer.qrToken;

      const customerSession = encodeSignedSession(customerUser);
      const req = new NextRequest('http://localhost:3000/api/qr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${customerSession}`,
        },
        body: JSON.stringify({
          action: 'scan',
          token,
          date: '2026-09-18',
        }),
      });

      const res = await postQrHandler(req);
      expect(res.status).toBe(403);
    });

    it('should allow customer to regenerate their own QR token', async () => {
      const customerSession = encodeSignedSession(customerUser);
      const req = new NextRequest('http://localhost:3000/api/qr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${customerSession}`,
        },
        body: JSON.stringify({
          action: 'regenerate',
          customerId: 'cust_ravi',
        }),
      });

      const res = await postQrHandler(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.token.startsWith('MF_QR_')).toBe(true);
    });

    it('should prevent cross-customer QR token regeneration (IDOR defense)', async () => {
      const customerSession = encodeSignedSession(customerUser);
      const req = new NextRequest('http://localhost:3000/api/qr', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${customerSession}`,
        },
        body: JSON.stringify({
          action: 'regenerate',
          customerId: 'cust_priya', // attempting to regenerate someone else's QR code
        }),
      });

      const res = await postQrHandler(req);
      expect(res.status).toBe(403);
    });
  });

  describe('Phase 13: Farmer Attention / Exception Center', () => {
    it('should aggregate pending pauses, extra milk, disputes, and payment issues for farmer', async () => {
      const farmerSession = encodeSignedSession(farmerUser);
      const req = new NextRequest('http://localhost:3000/api/farmer/attention', {
        headers: {
          authorization: `Bearer ${farmerSession}`,
        },
      });

      const res = await getAttentionHandler(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.summary).toBeDefined();
      expect(body.summary.totalAttentionCount).toBeGreaterThanOrEqual(0);
      expect(body.items.pauseRequests).toBeDefined();
      expect(body.items.extraMilkRequests).toBeDefined();
      expect(body.items.disputes).toBeDefined();
      expect(body.items.paymentIssues).toBeDefined();
    });

    it('should reject non-farmer access to Attention Center', async () => {
      const customerSession = encodeSignedSession(customerUser);
      const req = new NextRequest('http://localhost:3000/api/farmer/attention', {
        headers: {
          authorization: `Bearer ${customerSession}`,
        },
      });

      const res = await getAttentionHandler(req);
      expect(res.status).toBe(403);
    });
  });

  describe('Phase 19: Customer Analytics & Consumption Anomaly Engine', () => {
    it('should compute customer-level analytics and detect anomalies on unusual intake', async () => {
      const store = getStore();
      const customerId = 'cust_ravi';

      // Seed normal delivery history
      const ledger1 = store.getOrGenerateDailyLedger('2026-09-15');
      const rec1 = ledger1.find((r) => r.customerId === customerId);
      if (rec1) {
        store.updateDeliveryRecord(
          rec1.id,
          { status: 'DELIVERED', deliveredQuantity: 1.0 },
          { userId: 'user_farmer', name: 'Farmer', role: 'FARMER' }
        );
      }

      // Today has an unusual spike (4.0L vs 1.0L baseline)
      const ledger2 = store.getOrGenerateDailyLedger('2026-09-18');
      const rec2 = ledger2.find((r) => r.customerId === customerId);
      if (rec2) {
        store.updateDeliveryRecord(
          rec2.id,
          { status: 'DELIVERED', deliveredQuantity: 4.0 },
          { userId: 'user_farmer', name: 'Farmer', role: 'FARMER' }
        );
      }

      const req = new NextRequest(`http://localhost:3000/api/analytics/consumption?customerId=${customerId}&date=2026-09-18`);
      const res = await getConsumptionHandler(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.summary.totalDeliveredLitres).toBeGreaterThanOrEqual(5.0);
      expect(body.anomalyDetection.anomalyDetected).toBe(true);
      expect(body.anomalyDetection.anomalyReason).toContain('Unusual spike');
    });
  });

  describe('Phase 21: Sliding Window Rate Limiting', () => {
    it('should throttle requests once threshold is exceeded', () => {
      const testKey = 'ip_test_rate_limiter_' + Date.now();
      resetRateLimit(testKey);

      // Allow 3 requests
      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit(testKey, 3, 10);
        expect(result.allowed).toBe(true);
      }

      // 4th request must be throttled
      const throttled = checkRateLimit(testKey, 3, 10);
      expect(throttled.allowed).toBe(false);
      expect(throttled.remaining).toBe(0);
      expect(throttled.resetTimeSeconds).toBeGreaterThan(0);
    });
  });
});
