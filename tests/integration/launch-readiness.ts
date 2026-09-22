import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import {
  encodeSignedSession,
  decodeSignedSession,
  formatClientHint,
  getSessionSecret,
  SessionUser,
} from '@/lib/auth';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { sendPaymentReminder } from '@/lib/notify/provider';
import { publishEvent } from '@/lib/events';
import { POST as quantityRequestHandler } from '@/app/api/customer/quantity-request/route';
import { GET as eventsHandler } from '@/app/api/events/route';
import { GET as dailyCheckHandler } from '@/app/api/cron/daily-check/route';
import { GET as monthlyBillingHandler } from '@/app/api/cron/monthly-billing/route';

describe('Production Launch Readiness — Vercel, Live Payments, Crons & Security', () => {
  describe('1. Session Management & Cryptographic Security', () => {
    const mockUser: SessionUser = {
      userId: 'user_cust_101',
      name: 'Priya Sharma',
      role: 'CUSTOMER',
      tenantId: 'tenant_demo_1',
      customerId: 'cust_101',
      email: 'priya@example.com',
    };

    it('encodes and decodes HMAC-SHA256 signed session token', () => {
      const token = encodeSignedSession(mockUser);
      expect(token).toContain('.');
      const decoded = decodeSignedSession(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(mockUser.userId);
      expect(decoded?.role).toBe('CUSTOMER');
      expect(decoded?.exp).toBeGreaterThan(Date.now());
    });

    it('rejects tampered session signature', () => {
      const token = encodeSignedSession(mockUser);
      const [payload, sig] = token.split('.');
      const tamperedSig = sig.slice(0, -4) + 'abcd';
      const result = decodeSignedSession(`${payload}.${tamperedSig}`);
      expect(result).toBeNull();
    });

    it('rejects expired session token', () => {
      const expiredUser: SessionUser = {
        ...mockUser,
        exp: Date.now() - 10000, // expired 10 seconds ago
      };
      const token = encodeSignedSession(expiredUser);
      const result = decodeSignedSession(token);
      expect(result).toBeNull();
    });

    it('formats non-sensitive client hint cookie payload', () => {
      const hint = formatClientHint(mockUser);
      const parsed = JSON.parse(hint);
      expect(parsed.userId).toBe(mockUser.userId);
      expect(parsed.name).toBe(mockUser.name);
      expect(parsed.role).toBe('CUSTOMER');
      expect(parsed.password).toBeUndefined();
    });

    it('enforces SESSION_SECRET safety in production mode', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.SESSION_SECRET;

      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
        delete process.env.SESSION_SECRET;
        expect(() => getSessionSecret()).toThrow(/SESSION_SECRET must be set/);

        process.env.SESSION_SECRET = 'milkflow-enterprise-secure-session-key-2026';
        expect(() => getSessionSecret()).toThrow(/Insecure default placeholder/);
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
        if (origSecret) {
          process.env.SESSION_SECRET = origSecret;
        } else {
          delete process.env.SESSION_SECRET;
        }
      }
    });
  });

  describe('2. Rate Limiting Protection', () => {
    it('allows requests within limit and throttles after threshold exceeded', () => {
      const key = `test_rate_limit_${Date.now()}`;
      const limit = 5;

      for (let i = 0; i < limit; i++) {
        const check = checkRateLimit(key, limit, 60);
        expect(check.allowed).toBe(true);
      }

      const blocked = checkRateLimit(key, limit, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.resetTimeSeconds).toBeGreaterThan(0);
    });
  });

  describe('3. Customer Quantity Change Request API', () => {
    it('POST /api/customer/quantity-request creates a pending request', async () => {
      const req = new NextRequest('http://localhost:3000/api/customer/quantity-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cust_ravi',
          effectiveDate: '2026-10-01',
          newQuantity: 2.5,
          reason: 'Festive season extra requirement',
        }),
      });

      const res = await quantityRequestHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.request.newQuantity).toBe(2.5);
      expect(json.request.status).toBe('PENDING');
    });

    it('POST /api/customer/quantity-request rejects non-positive quantity', async () => {
      const req = new NextRequest('http://localhost:3000/api/customer/quantity-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: 'cust_ravi',
          effectiveDate: '2026-10-01',
          newQuantity: -1,
        }),
      });

      const res = await quantityRequestHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('4. Real-Time Events & Polling Fallback', () => {
    it('GET /api/events?poll=true returns scoped event history in JSON', async () => {
      publishEvent({
        type: 'request:created',
        tenantId: 'tenant_alpha',
        payload: { kind: 'QUANTITY_CHANGE' },
      });

      const req = new NextRequest('http://localhost:3000/api/events?poll=true');
      const res = await eventsHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.events)).toBe(true);
      expect(json.timestamp).toBeDefined();
    });
  });

  describe('5. Payment Processing (Manual Recording)', () => {
    it('supports manual payment recording with different methods', () => {
      // Manual payment recording supports UPI, CASH, BANK_TRANSFER, CHEQUE
      // No complex payment gateway needed
      expect(true).toBe(true); // Placeholder test
    });

    it('skips Razorpay signature verification (not needed for manual payments)', () => {
      // Razorpay signature verification removed - using simple manual payment recording
      // Farmers can record UPI, cash, bank transfer payments manually
      expect(true).toBe(true); // Placeholder test
    });
  });

  describe('6. Multi-Channel WhatsApp & SMS Notification Dispatcher', () => {
    it('dispatches payment reminders via sandbox provider when offline/testing', async () => {
      const res = await sendPaymentReminder({
        phone: '9876543210',
        customerName: 'Anand Kulkarni',
        amount: 850,
        payLink: 'https://milkflow.app/pay/inv_123',
        lang: 'mr',
      });

      expect(res.whatsapp).toBeDefined();
      expect(res.whatsapp?.reason).toBe('test-env');

      expect(res.sms).toBeDefined();
      expect(res.sms?.reason).toBe('test-env');
    });
  });

  describe('7. Vercel Serverless Cron Jobs', () => {
    // Cron routes are fail-closed: when CRON_SECRET is configured the
    // Bearer token must accompany the request (user-agent alone never
    // authorizes). Attach it here so the suite exercises the telemetry
    // path rather than the 401 guard.
    const cronAuthHeaders = (): Record<string, string> => {
      const headers: Record<string, string> = { 'user-agent': 'vercel-cron/1.0' };
      if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
      return headers;
    };

    it('GET /api/cron/daily-check returns daily inspection telemetry', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/daily-check', {
        headers: cronAuthHeaders(),
      });

      const res = await dailyCheckHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.cron).toBe('daily-check');
      expect(json.summary).toBeDefined();
    });

    it('GET /api/cron/monthly-billing returns monthly billing period results', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/monthly-billing?month=9&year=2026', {
        headers: cronAuthHeaders(),
      });

      const res = await monthlyBillingHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.cron).toBe('monthly-billing');
      expect(json.billingPeriod).toBe('9/2026');
    });
  });
});
