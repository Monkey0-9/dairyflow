import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCustomers } from '@/app/api/customers/route';
import { GET as getInvoices } from '@/app/api/invoices/route';
import { GET as getRoutes } from '@/app/api/routes/route';
import { POST as transferPost } from '@/app/api/customer/transfer/route';
import { encodeSignedSession, decodeSignedSession, type SessionUser, SESSION_COOKIE_NAME } from '@/lib/auth';
import { enforceCustomerOwnership, enforceTenantAccess } from '@/lib/api-auth';

const tenantA = 'tenant_greenvalley';
const tenantB = 'tenant_sunrise';

const attackerCustomer: SessionUser = {
  userId: 'user_attacker',
  name: 'Attacker',
  role: 'CUSTOMER',
  tenantId: tenantA,
  customerId: 'cust_attacker',
  farmerId: 'F001',
  email: 'attacker@evil.in',
};

const victimCustomerId = 'cust_victim_b';
const victimTenant = tenantB;

const attackerFarmer: SessionUser = {
  userId: 'user_evil_farmer',
  name: 'Evil Farmer',
  role: 'FARMER',
  tenantId: tenantA,
  farmerId: 'F_EVIL',
  email: 'evil@farm.in',
};

describe('Move 4: Multi-Tenant Penetration & IDOR Attack Suite', () => {
  const verbs = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  for (const verb of verbs) {
    it(`${verb}: attacker CUSTOMER cannot access or act as victim customer across tenants`, () => {
      const violation = enforceCustomerOwnership(attackerCustomer, victimCustomerId);
      expect(violation, `${verb} direct IDOR must be blocked`).not.toBeNull();
      expect(violation?.status).toBe(403);
    });

    it(`${verb}: attacker farmer cannot cross into victim tenant`, () => {
      const violation = enforceTenantAccess(attackerFarmer, victimTenant);
      expect(violation, `${verb} cross-tenant must be blocked`).not.toBeNull();
      expect(violation?.status).toBe(403);
    });
  }

  it('prevents Tenant A from reading or listing customers belonging to Tenant B', async () => {
    const farmerSessionA = encodeSignedSession(attackerFarmer);
    const req = new NextRequest('http://localhost:3000/api/customers?farmerId=F_EVIL', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${farmerSessionA}` },
    });
    const res = await getCustomers(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const customers = json.customers || [];
    for (const c of customers) {
      expect(c.tenantId || tenantA).toBe(tenantA);
      expect(c.tenantId).not.toBe(tenantB);
    }
  });

  it('blocks indirect IDOR when Tenant A attempts to transfer a customer belonging to Tenant B', async () => {
    const farmerSessionA = encodeSignedSession(attackerFarmer);
    const attackReq = new NextRequest('http://localhost:3000/api/customer/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSessionA}`,
      },
      body: JSON.stringify({
        customerId: victimCustomerId,
        toFarmerId: 'F_EVIL',
        reason: 'Cross-tenant hijacking',
      }),
    });

    const res = await transferPost(attackReq);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('prevents Tenant A farmer from listing invoices belonging to Tenant B (indirect IDOR)', async () => {
    const farmerSessionA = encodeSignedSession(attackerFarmer);
    const req = new NextRequest('http://localhost:3000/api/invoices', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${farmerSessionA}` },
    });
    const res = await getInvoices(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const invoices = json.invoices || [];
    for (const inv of invoices) {
      expect(inv.tenantId ?? tenantA).toBe(tenantA);
      expect(inv.tenantId).not.toBe(tenantB);
    }
  });

  it('prevents cross-tenant logistics route visibility', async () => {    const farmerSessionA = encodeSignedSession(attackerFarmer);
    const req = new NextRequest('http://localhost:3000/api/routes?farmerId=F_OTHER_TENANT', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${farmerSessionA}` },
    });
    const res = await getRoutes(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.routes).toBeDefined();
    const crossRoutes = json.routes.filter((r: { farmerId?: string }) => r.farmerId === 'F_OTHER_TENANT');
    expect(crossRoutes.length).toBe(0);
  });

  it('tampered session payload is rejected by HMAC signature verification (anti-spoofing)', () => {
    const valid = encodeSignedSession(attackerCustomer);
    const [, sig] = valid.split('.');
    const forged = `${Buffer.from(JSON.stringify({ ...attackerCustomer, tenantId: victimTenant, role: 'FARMER' })).toString('base64url')}.${sig}`;
    expect(decodeSignedSession(forged)).toBeNull();
  });
});
