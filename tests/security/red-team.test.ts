import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import {
  encodeSignedSession,
  decodeSignedSession,
  decodeSession,
  SessionUser,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';
import {
  authenticateRequest,
  enforceCustomerOwnership,
  enforceTenantAccess,
} from '@/lib/api-auth';
import { GET as getFarmerAttentionHandler } from '@/app/api/farmer/attention/route';
import { GET as getStatementHandler } from '@/app/api/invoices/statement/route';
import { POST as postWebhookHandler } from '@/app/api/webhook/payment/route';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { getStore } from '@/lib/store';

describe('Stage 4: Red Team Security & Penetration Suite', () => {
  const legitFarmerA: SessionUser = {
    userId: 'usr_farmer_alpha',
    name: 'Farmer Alpha',
    role: 'FARMER',
    tenantId: 'tenant_alpha',
    farmerId: 'f_alpha',
    email: 'alpha@dairy.in',
  };

  const legitFarmerB: SessionUser = {
    userId: 'usr_farmer_beta',
    name: 'Farmer Beta',
    role: 'FARMER',
    tenantId: 'tenant_beta',
    farmerId: 'f_beta',
    email: 'beta@dairy.in',
  };

  const legitCustomerA: SessionUser = {
    userId: 'usr_cust_a',
    name: 'Customer A',
    role: 'CUSTOMER',
    tenantId: 'tenant_alpha',
    customerId: 'cust_alpha_01',
    farmerId: 'f_alpha',
    email: 'custA@example.com',
  };

  const legitCustomerB: SessionUser = {
    userId: 'usr_cust_b',
    name: 'Customer B',
    role: 'CUSTOMER',
    tenantId: 'tenant_alpha',
    customerId: 'cust_alpha_02',
    farmerId: 'f_alpha',
    email: 'custB@example.com',
  };

  // =========================================================================
  // 1. Authentication Attacks
  // =========================================================================
  describe('1. Authentication Attacks', () => {
    it('rejects forged session with forged signature', () => {
      const forgedPayload = Buffer.from(
        JSON.stringify({ ...legitCustomerA, role: 'SUPERADMIN' })
      ).toString('base64url');
      const bogusSignature = 'completely_forged_signature_000000000000';
      const forgedToken = `${forgedPayload}.${bogusSignature}`;

      const decoded = decodeSignedSession(forgedToken);
      expect(decoded).toBeNull();
    });

    it('rejects expired session token', () => {
      const expiredUser: SessionUser = {
        ...legitCustomerA,
        exp: Date.now() - 3600000, // expired 1 hour ago
      };
      const token = encodeSignedSession(expiredUser);
      const decoded = decodeSignedSession(token);
      expect(decoded).toBeNull();

      // Also via general decodeSession
      expect(decodeSession(token)).toBeNull();
    });

    it('detects altered role attack (CUSTOMER payload tampered into FARMER or SUPERADMIN)', () => {
      const validToken = encodeSignedSession(legitCustomerA);
      const [, validSignature] = validToken.split('.');

      // Attacker tampers payload but reuses old signature
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...legitCustomerA, role: 'SUPERADMIN' })
      ).toString('base64url');
      const tamperedToken = `${tamperedPayload}.${validSignature}`;

      expect(decodeSignedSession(tamperedToken)).toBeNull();
    });

    it('detects altered tenant attack (tenantId modified in token payload)', () => {
      const validToken = encodeSignedSession(legitCustomerA);
      const [, validSignature] = validToken.split('.');

      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...legitCustomerA, tenantId: 'tenant_victim_target' })
      ).toString('base64url');
      const tamperedToken = `${tamperedPayload}.${validSignature}`;

      expect(decodeSignedSession(tamperedToken)).toBeNull();
    });

    it('detects altered user ID attack (userId modified to target administrator)', () => {
      const validToken = encodeSignedSession(legitCustomerA);
      const [, validSignature] = validToken.split('.');

      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...legitCustomerA, userId: 'user_superadmin_master' })
      ).toString('base64url');
      const tamperedToken = `${tamperedPayload}.${validSignature}`;

      expect(decodeSignedSession(tamperedToken)).toBeNull();
    });

    it('blocks malformed token structure (no dot, extra dots, empty string)', () => {
      expect(decodeSignedSession('')).toBeNull();
      expect(decodeSignedSession('not-a-token')).toBeNull();
      expect(decodeSignedSession('part1.part2.part3')).toBeNull();
    });
  });

  // =========================================================================
  // 2. Authorization & RBAC Attacks
  // =========================================================================
  describe('2. Authorization & RBAC Attacks', () => {
    it('blocks Customer from accessing Farmer API (/api/farmer/attention)', async () => {
      const token = encodeSignedSession(legitCustomerA);
      const req = new NextRequest('http://localhost:3000/api/farmer/attention', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
          authorization: `Bearer ${token}`,
        },
      });

      const res = await getFarmerAttentionHandler(req);
      expect(res.status).toBe(403);
    });

    it('blocks Farmer from invoking SuperAdmin endpoints', () => {
      const token = encodeSignedSession(legitFarmerA);
      const req = new NextRequest('http://localhost:3000/api/superadmin/tenants', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const auth = authenticateRequest(req, ['SUPERADMIN']);
      expect('errorResponse' in auth).toBe(true);
      if ('errorResponse' in auth) {
        expect(auth.errorResponse.status).toBe(403);
      }
    });

    it('blocks Farmer A from accessing Farmer B tenant resources (cross-tenant isolation)', () => {
      const violation = enforceTenantAccess(legitFarmerA, legitFarmerB.tenantId);
      expect(violation).not.toBeNull();
      expect(violation?.status).toBe(403);
    });

    it('blocks Customer A from accessing Customer B statement/records (IDOR protection)', async () => {
      const tokenA = encodeSignedSession(legitCustomerA);
      const req = new NextRequest(
        `http://localhost:3000/api/invoices/statement?customerId=${legitCustomerB.customerId}`,
        {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
            authorization: `Bearer ${tokenA}`,
          },
        }
      );

      const res = await getStatementHandler(req);
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. API Hostile Payloads & Input Abuse
  // =========================================================================
  describe('3. API Hostile Payloads & Abuse', () => {
    it('blocks IDOR attempts across non-owned identifiers', () => {
      const violation = enforceCustomerOwnership(legitCustomerA, 'cust_stolen_id_999');
      expect(violation).not.toBeNull();
      expect(violation?.status).toBe(403);
    });

    it('handles malformed JSON body safely without unhandled exception crashes', async () => {
      const req = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '<<<MALFORMED_JSON_ATTACK{bad:true',
      });

      const res = await postWebhookHandler(req);
      expect(res.status).toBe(500); // Caught and returned as standard 500 JSON error
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('enforces sliding window rate-limiting to prevent rate-limit bypass and DoS', () => {
      const attackKey = `red_team_dos_ip_${Date.now()}`;
      const maxRequests = 10;
      const windowSeconds = 2;

      // 10 permitted calls
      for (let i = 0; i < maxRequests; i++) {
        const check = checkRateLimit(attackKey, maxRequests, windowSeconds);
        expect(check.allowed).toBe(true);
      }

      // 11th call exceeds limit and must be throttled
      const blocked = checkRateLimit(attackKey, maxRequests, windowSeconds);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });
  });

  // =========================================================================
  // 4. Payment Gateway Attacks
  // =========================================================================
  describe('4. Payment Gateway Webhook Attacks', () => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_milkflow_prod_demo_key_9812';

    it('rejects fake transaction with invalid HMAC signature', async () => {
      const body = JSON.stringify({
        transactionRef: 'fake_txn_001',
        invoiceId: 'inv_fake_001',
        amount: 500.0,
      });

      const req = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000',
        },
        body,
      });

      const res = await postWebhookHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Invalid webhook HMAC signature');
    });

    it('rejects missing transaction reference or amount', async () => {
      const body = JSON.stringify({
        invoiceId: 'inv_valid_id',
        // missing transactionRef and amount
      });

      const sig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

      const req = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body,
      });

      const res = await postWebhookHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('required');
    });

    it('rejects payment targeting a non-existent invoice', async () => {
      const body = JSON.stringify({
        transactionRef: 'valid_looking_txn_9999',
        invoiceId: 'inv_non_existent_99999999',
        amount: 150.0,
      });

      const sig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

      const req = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body,
      });

      const res = await postWebhookHandler(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('Invoice not found');
    });

    it('safely handles duplicate webhook delivery idempotently without double settlement', async () => {
      const store = getStore();
      const cust = store.customers[0];
      const inv = store.recalculateMonthlyInvoice(cust.id, 9, 2026);
      const invoiceId = inv ? inv.id : 'inv_test';

      const body = JSON.stringify({
        transactionRef: `idempotent_txn_test_${Date.now()}`,
        invoiceId,
        amount: 50.0,
        paymentMethod: 'UPI',
      });

      const sig = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');

      // First webhook post
      const req1 = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body,
      });

      const res1 = await postWebhookHandler(req1);
      expect(res1.status).toBe(200);

      // Duplicate replay of the exact same webhook
      const req2 = new NextRequest('http://localhost:3000/api/webhook/payment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body,
      });

      const res2 = await postWebhookHandler(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.status).toBe('ALREADY_PROCESSED');
      expect(json2.message).toContain('already processed');
    });
  });
});
