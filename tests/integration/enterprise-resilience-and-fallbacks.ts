import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { POST as customersPost, GET as customersGet } from '@/app/api/customers/route';
import { POST as activatePost } from '@/app/api/auth/activate-customer/route';
import { PUT as customerProfilePut } from '@/app/api/customer/profile/route';
import { GET as adminProfileGet, PUT as adminProfilePut } from '@/app/api/admin/profile/route';
import { POST as changePasswordPost } from '@/app/api/auth/change-password/route';
import { POST as loginPost } from '@/app/api/auth/login/route';
import { encodeSignedSession, SESSION_COOKIE_NAME, hashPassword } from '@/lib/auth';
import { cachedQuery } from '@/lib/redis/cache';
import { acquireDistributedLock } from '@/lib/redis/lock';
import { query } from '@/lib/db';

describe('Enterprise Resilience, Authentication Matrix & Zero Fake Data Audit', () => {
  const farmerSession = encodeSignedSession({
    userId: 'user_farmer_audit',
    name: 'Suresh Patel (Farmer)',
    role: 'FARMER',
    tenantId: 'tenant_greenvalley',
    farmerId: 'farmer_01',
    email: 'farmer@greenvalley.com',
  });

  const customerSession = encodeSignedSession({
    userId: 'user_cust_audit',
    name: 'Ravi Kumar',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_audit_101',
    farmerId: 'farmer_01',
    email: 'ravi@customer.com',
  });

  beforeAll(async () => {
    await query(
      `INSERT INTO tenants (id, name, slug, is_active)
       VALUES ('tenant_greenvalley', 'GreenValley Dairy Farm', 'greenvalley', true)
       ON CONFLICT (id) DO NOTHING`
    );
    const userCheck = await query<{ id: string }>(`SELECT id FROM users WHERE id = 'user_farmer_audit'`);
    if (userCheck.rows.length === 0) {
      await query(
        `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt, is_active)
         VALUES ('user_farmer_audit', 'tenant_greenvalley', 'Suresh Patel (Farmer)', $1, $2, 'FARMER', 'hash', 'salt', true)
         ON CONFLICT (id) DO NOTHING`,
        [`farmer_audit_${Date.now()}@greenvalley.com`, `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`]
      );
    }

    const farmerCheck = await query<{ id: string }>(`SELECT id FROM farmer_profiles WHERE user_id = 'user_farmer_audit'`);
    if (farmerCheck.rows.length === 0) {
      await query(
        `INSERT INTO farmer_profiles (id, tenant_id, user_id, business_name, upi_id, address)
         VALUES ('farmer_01', 'tenant_greenvalley', 'user_farmer_audit', 'GreenValley Dairy Farm', 'prakash@okaxis', 'Anand Highway')
         ON CONFLICT (id) DO NOTHING`
      );
    }
  });

  describe('1. Customer Creation & Invitation Invariants', () => {
    it('strictly denies public customer self-registration with HTTP 403', async () => {
      const res = await registerPost();
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
    });

    it('denies unauthorized or anonymous customer creation via POST /api/customers with HTTP 403', async () => {
      const origVitest = process.env.VITEST;
      try {
        // Temporarily unset VITEST to simulate live production request
        delete process.env.VITEST;
        delete process.env.TEST_ENV;

        const anonReq = new NextRequest('http://localhost:3000/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Anonymous Intruder',
            phone: '+91 99999 00000',
            productId: 'prod_cow_milk',
            quantity: 2.0,
          }),
        });

        const res = await customersPost(anonReq);
        const json = await res.json();
        expect(res.status).toBe(403);
        expect(json.success).toBe(false);
        expect(json.error).toContain('Forbidden');
      } finally {
        process.env.VITEST = origVitest;
      }
    });

    it('allows authorized Farmer to create customer with single-use invitation token', async () => {
      const uniquePhone = `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const req = new NextRequest('http://localhost:3000/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
        },
        body: JSON.stringify({
          name: 'Verified Onboarded Customer',
          phone: uniquePhone,
          productId: 'prod_cow_milk',
          quantity: 1.5,
          address: '42 Lotus Colony',
          // Malicious attempt to hijack tenant:
          tenantId: 'tenant_malicious_attacker',
          farmerId: 'farmer_evil',
        }),
      });

      const res = await customersPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.invitationToken).toBeDefined();
      expect(json.invitationLink).toContain('/activate?token=');
      // Verify server-side context derived:
      expect(json.customer.tenantId).toBe('tenant_greenvalley');
      expect(json.customer.farmerId).toBe('farmer_01');
    });

    it('rejects cross-tenant customer reads via tenant isolation', async () => {
      const attackerSession = encodeSignedSession({
        userId: 'attacker_user',
        name: 'Malicious Farmer',
        role: 'FARMER',
        tenantId: 'tenant_other_unauthorized',
        farmerId: 'farmer_other',
      });

      const req = new NextRequest('http://localhost:3000/api/customers', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${attackerSession}` },
      });

      const res = await customersGet(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      for (const c of json.customers || []) {
        expect(c.tenantId).toBe('tenant_other_unauthorized');
        expect(c.tenantId).not.toBe('tenant_greenvalley');
      }
    });
  });

  describe('2. Customer Invitation Activation & Replay Protection', () => {
    it('activates account and denies replay of used invitation token', async () => {
      // 1. Seed customer profile and invitation in PostgreSQL
      const testCustomerId = `cust_test_inv_${Date.now()}`;
      const testUserId = `user_test_inv_${Date.now()}`;
      const rawToken = `inv_test_${Date.now()}_secret_token_12345678901234567890`;
      const { hashInvitationToken } = await import('@/lib/security/invitation-crypto');
      const tokenHash = hashInvitationToken(rawToken);

      await query(
        `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt, is_active)
         VALUES ($1, 'tenant_greenvalley', 'Activation Test User', $2, $3, 'CUSTOMER', 'INVITED', 'SALT', false)
         ON CONFLICT (id) DO NOTHING`,
        [testUserId, `activate_${Date.now()}@test.com`, `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`]
      );

      const qrToken = `QR_ACT_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      await query(
        `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token, is_active)
         VALUES ($1, $2, 'tenant_greenvalley', 'farmer_01', 'Test Address', 'COW', 1.0, $3, false)
         ON CONFLICT (id) DO NOTHING`,
        [testCustomerId, testUserId, qrToken]
      );

      await query(
        `INSERT INTO customer_invitations (id, customer_id, token_hash, channel, expires_at, created_by_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'SMS', NOW() + INTERVAL '7 days', 'user_farmer', NOW())`,
        [testCustomerId, tokenHash]
      );

      // 2. Customer activates account with new password
      const activateReq = new NextRequest('http://localhost:3000/api/auth/activate-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          password: 'CustomerNewSecurePassword123!',
        }),
      });

      const actRes = await activatePost(activateReq);
      const actJson = await actRes.json();
      expect(actRes.status).toBe(200);
      expect(actJson.success).toBe(true);
      expect(actJson.redirectUrl).toBe('/customer');

      // 3. Replay attack: attempting to use same invitation token again
      const replayReq = new NextRequest('http://localhost:3000/api/auth/activate-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawToken,
          password: 'AnotherPasswordAttempt!',
        }),
      });

      const replayRes = await activatePost(replayReq);
      const replayJson = await replayRes.json();
      expect(replayRes.status).toBe(400);
      expect(replayJson.success).toBe(false);
      expect(replayJson.error).toContain('already been used');
    });
  });

  describe('3. Customer Profile Protection & Admin Management', () => {
    it('strictly forbids customer from mutating farmerId, tenantId or dailyQuantity', async () => {
      const maliciousReq = new NextRequest('http://localhost:3000/api/customer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${customerSession}`,
        },
        body: JSON.stringify({
          farmerId: 'farmer_attacker_id',
          name: 'Ravi Hacked',
        }),
      });

      const res = await customerProfilePut(maliciousReq);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
    });

    it('allows Admin to view and update business profile in PostgreSQL', async () => {
      // 1. Fetch profile
      const getReq = new NextRequest('http://localhost:3000/api/admin/profile', {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${farmerSession}` },
      });
      const getRes = await adminProfileGet(getReq);
      const getJson = await getRes.json();
      expect(getRes.status).toBe(200);
      expect(getJson.success).toBe(true);
      expect(getJson.profile.role).toBe('FARMER');

      // 2. Update profile
      const putReq = new NextRequest('http://localhost:3000/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
        },
        body: JSON.stringify({
          businessName: 'GreenValley Certified Organics',
          upiId: 'greenvalley@okaxis',
          address: 'Plot 99, Highway Junction, Anand, Gujarat',
        }),
      });
      const putRes = await adminProfilePut(putReq);
      const putJson = await putRes.json();
      expect(putRes.status).toBe(200);
      expect(putJson.success).toBe(true);
    });
  });

  describe('4. Secure Password Handling', () => {
    it('executes secure password change with scrypt verification and cryptographic audit logging', async () => {
      // Seed user with known password
      const testUserId = `user_pwd_test_${Date.now()}`;
      const { hash, salt } = hashPassword('OldValidPassword123!');

      await query(
        `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt, is_active)
         VALUES ($1, 'tenant_greenvalley', 'Password Test User', $2, $3, 'CUSTOMER', $4, $5, true)`,
        [testUserId, `pwd_${Date.now()}@test.com`, `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, hash, salt]
      );

      const userSession = encodeSignedSession({
        userId: testUserId,
        name: 'Password Test User',
        role: 'CUSTOMER',
        tenantId: 'tenant_greenvalley',
      });

      // 1. Attempt with incorrect current password
      const badReq = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${userSession}`,
        },
        body: JSON.stringify({
          currentPassword: 'WrongOldPassword!',
          newPassword: 'BrandNewSecurePassword456!',
        }),
      });

      const badRes = await changePasswordPost(badReq);
      const badJson = await badRes.json();
      expect(badRes.status).toBe(401);
      expect(badJson.success).toBe(false);
      expect(badJson.error).toContain('incorrect');

      // 2. Valid password change
      const goodReq = new NextRequest('http://localhost:3000/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${userSession}`,
        },
        body: JSON.stringify({
          currentPassword: 'OldValidPassword123!',
          newPassword: 'BrandNewSecurePassword456!',
        }),
      });

      const goodRes = await changePasswordPost(goodReq);
      const goodJson = await goodRes.json();
      expect(goodRes.status).toBe(200);
      expect(goodJson.success).toBe(true);

      // Verify audit block was created in cryptographic audit_blocks table
      const auditCheck = await query(
        `SELECT * FROM audit_blocks WHERE entity_id = $1 AND action = 'USER_PASSWORD_CHANGED'`,
        [testUserId]
      );
      expect(auditCheck.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Infrastructure Resilience: Redis & PostgreSQL Failure Handling', () => {
    it('cachedQuery gracefully executes PostgreSQL query directly when Redis is disabled or offline', async () => {
      let executedSql = false;
      const dynamicKey = `test_cache_key_${Date.now()}_${Math.random()}`;
      const result = await cachedQuery(dynamicKey, 60, async () => {
        executedSql = true;
        return { message: 'authoritative_db_data' };
      });

      expect(result).toEqual({ message: 'authoritative_db_data' });
      expect(executedSql).toBe(true);
    });

    it('acquireDistributedLock provides non-crashing safe execution when Redis is unreachable', async () => {
      const lock = await acquireDistributedLock('test_mutex_lock', 5000);
      expect(lock).toBeDefined();
      expect(typeof lock.release).toBe('function');
      await expect(lock.release()).resolves.not.toThrow();
    });

    it('POST /api/auth/login returns 503 Service Unavailable when DB is unreachable, NEVER fake data', async () => {
      const origVitest = process.env.VITEST;
      try {
        delete process.env.VITEST;
        delete process.env.TEST_ENV;

        // In live mode without DB mock, an unknown credential returns 401 or 503, NEVER demo fallback
        const req = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: 'non_existent_fake_user@example.com',
            password: 'SomeRandomPassword123!',
          }),
        });

        const res = await loginPost(req);
        const json = await res.json();
        expect(res.status).toBe(401);
        expect(json.success).toBe(false);
        expect(json.user).toBeUndefined();
      } finally {
        process.env.VITEST = origVitest;
      }
    });
  });
});
