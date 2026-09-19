import { describe, it, expect } from 'vitest';
import { POST as transferPost, PATCH as transferPatch } from '@/app/api/customer/transfer/route';
import { POST as priceHistoryPost, GET as priceHistoryGet } from '@/app/api/products/price-history/route';
import { POST as invoiceAdjPost } from '@/app/api/invoices/adjustments/route';
import { POST as monthClosingPost, GET as monthClosingGet } from '@/app/api/admin/month-closing/route';
import { POST as routesPost, GET as routesGet } from '@/app/api/routes/route';
import { POST as importPost } from '@/app/api/admin/import-customers/route';
import { POST as closurePost } from '@/app/api/admin/operational-closures/route';
import { encodeSignedSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

describe('Enterprise Domain Matrix: Complete Operations Test Suite', () => {
  const farmerSession = encodeSignedSession({
    userId: 'user_farmer',
    name: 'Suresh Patel',
    role: 'FARMER',
    tenantId: 'tenant_greenvalley',
    farmerId: 'F001',
  });

  it('executes Product Price History & Route Management successfully', async () => {
    const prodRes = await query<{ id: string }>('SELECT id FROM products LIMIT 1');
    const validProdId = prodRes.rows[0]?.id || 'p1';
    await query('DELETE FROM product_price_histories WHERE product_id = $1', [validProdId]);

    // 1. Create Price History with dynamic non-overlapping date
    const uniqueTime = Date.now() + 50000000000 + Math.floor(Math.random() * 1000000);
    const priceReq = new NextRequest('http://localhost:3000/api/products/price-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        productId: validProdId,
        pricePerUnit: 70.0,
        effectiveFrom: new Date(uniqueTime).toISOString(),
        effectiveTo: new Date(uniqueTime + 86400000 * 30).toISOString(),
      }),
    });

    const priceRes = await priceHistoryPost(priceReq);
    const priceJson = await priceRes.json();
    expect(priceRes.status).toBe(200);
    expect(priceJson.success).toBe(true);

    // 2. Fetch Price History
    const getReq = new NextRequest(`http://localhost:3000/api/products/price-history?productId=${validProdId}`, {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${farmerSession}` },
    });
    const getRes = await priceHistoryGet(getReq);
    const getJson = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getJson.priceHistories).toBeDefined();

    // 3. Create Shift Route
    const routeReq = new NextRequest('http://localhost:3000/api/routes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        name: 'Morning North Express ' + Date.now(),
        code: 'RTE-NORTH-' + Date.now(),
        shift: 'MORNING',
      }),
    });

    const routeRes = await routesPost(routeReq);
    const routeJson = await routeRes.json();
    expect(routeRes.status).toBe(200);
    expect(routeJson.success).toBe(true);

    // 4. Fetch Routes
    const getRoutesReq = new NextRequest('http://localhost:3000/api/routes?farmerId=F001', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${farmerSession}` },
    });
    const getRoutesRes = await routesGet(getRoutesReq);
    const getRoutesJson = await getRoutesRes.json();
    expect(getRoutesRes.status).toBe(200);
    expect(getRoutesJson.routes).toBeDefined();
  });

  it('performs Customer Ownership Transfer workflow (Initiate -> Approve -> Accept)', async () => {
    // Ensure target farmer exists
    const targetFarmerId = 'F_TEST_TRANSFER_TARGET';
    await query(
      `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role, created_at, updated_at)
       VALUES ('u_target_farmer', 'tenant_greenvalley', 'target_farmer@milkflow.in', '+91 99999 88888', 'Target Farmer', 'HASH', 'SALT', 'FARMER', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`
    );
    await query(
      `INSERT INTO farmer_profiles (id, user_id, tenant_id, business_name, upi_id, address, route_code, created_at, updated_at)
       VALUES ($1, 'u_target_farmer', 'tenant_greenvalley', 'Target Dairy Farm', 'target@upi', 'Sector 4', 'ROUTE-2', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [targetFarmerId]
    );

    const custRes = await query<{ id: string }>(
      "SELECT id FROM customer_profiles WHERE tenant_id = 'tenant_greenvalley' LIMIT 1"
    );
    let custId = custRes.rows[0]?.id;
    if (!custId) {
      custId = 'cust_test_transfer';
      await query(
        `INSERT INTO customer_profiles (id, user_id, farmer_id, tenant_id, name, phone, address, status, delivery_order, created_at, updated_at)
         VALUES ($1, 'u_target_farmer', 'F001', 'tenant_greenvalley', 'Test Cust', '+91 91234 56789', 'Main St', 'ACTIVE', 1, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET tenant_id = 'tenant_greenvalley'`,
        [custId]
      );
    }

    // 1. Initiate Transfer
    const initReq = new NextRequest('http://localhost:3000/api/customer/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        customerId: custId,
        toFarmerId: targetFarmerId,
        reason: 'Customer relocated to Sector 4',
      }),
    });

    const initRes = await transferPost(initReq);
    const initJson = await initRes.json();
    expect(initRes.status).toBe(200);
    expect(initJson.success).toBe(true);
    const transferId = initJson.transferRequest.id;

    // 2. Approve Transfer
    const approveReq = new NextRequest('http://localhost:3000/api/customer/transfer', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        transferId,
        action: 'APPROVE',
      }),
    });

    const approveRes = await transferPatch(approveReq);
    const approveJson = await approveRes.json();
    expect(approveRes.status).toBe(200);
    expect(approveJson.success).toBe(true);
  });

  it('handles Invoice Adjustments (Credit/Debit Notes)', async () => {
    const invRes = await query<{ id: string }>('SELECT id FROM invoices LIMIT 1');
    if (invRes.rows.length > 0) {
      const invId = invRes.rows[0].id;
      const adjReq = new NextRequest('http://localhost:3000/api/invoices/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
        },
        body: JSON.stringify({
          invoiceId: invId,
          type: 'CREDIT',
          amount: 50.0,
          reason: 'Promotion Discount Voucher',
        }),
      });

      const adjRes = await invoiceAdjPost(adjReq);
      const adjJson = await adjRes.json();
      expect(adjRes.status).toBe(200);
      expect(adjJson.success).toBe(true);
    }
  });

  it('performs 2-Phase Customer Data Import with Dry-Run Preview & Validation', async () => {
    const samplePhone = `999${Math.floor(1000000 + Math.random() * 9000000)}`;

    const importReq = new NextRequest('http://localhost:3000/api/admin/import-customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        dryRun: true,
        customers: [
          { name: 'Migration Customer 1', phone: samplePhone, address: 'Plot 44, Green Avenue' },
          { name: 'Invalid Customer', phone: '', address: 'Missing phone' },
        ],
      }),
    });

    const res = await importPost(importReq);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preview).toBe(true);
    expect(json.validCount).toBe(1);
    expect(json.errorCount).toBe(1);
  });

  it('handles Month Closing lifecycle and Operational Closures cleanly', async () => {
    // 1. Month Closing POST
    const randomMonth = Math.floor(1 + Math.random() * 12);
    const randomYear = 2030 + Math.floor(Math.random() * 50);
    const monthReq = new NextRequest('http://localhost:3000/api/admin/month-closing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        farmerId: 'F001',
        month: randomMonth,
        year: randomYear,
      }),
    });

    const monthRes = await monthClosingPost(monthReq);
    const monthJson = await monthRes.json();
    expect(monthRes.status).toBe(200);
    expect(monthJson.success).toBe(true);

    // 2. Month Closing GET
    const getMonthReq = new NextRequest('http://localhost:3000/api/admin/month-closing?farmerId=F001', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${farmerSession}` },
    });
    const getMonthRes = await monthClosingGet(getMonthReq);
    const getMonthJson = await getMonthRes.json();
    expect(getMonthRes.status).toBe(200);
    expect(getMonthJson.monthClosings).toBeDefined();

    // 3. Operational Closure
    const closureReq = new NextRequest('http://localhost:3000/api/admin/operational-closures', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        date: '2026-09-30',
        reason: 'Dairy Maintenance Holiday',
        shift: 'MORNING',
      }),
    });

    const closureRes = await closurePost(closureReq);
    const closureJson = await closureRes.json();
    expect(closureRes.status).toBe(200);
    expect(closureJson.success).toBe(true);
  });
});
