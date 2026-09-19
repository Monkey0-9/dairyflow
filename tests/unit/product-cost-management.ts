import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createProduct, PATCH as updateProductCost } from '@/app/api/products/route';
import { encodeSignedSession, SESSION_COOKIE_NAME } from '@/lib/auth';

describe('Milk & Product Cost Management for Farmer and Admin', () => {
  const tenantId = 'tenant_greenvalley';
  const farmerSession = encodeSignedSession({
    userId: 'user_farmer',
    name: 'Suresh Patel',
    role: 'FARMER',
    tenantId,
    farmerId: 'F001',
  });

  const customerSession = encodeSignedSession({
    userId: 'user_customer_test',
    name: 'Ravi Customer',
    role: 'CUSTOMER',
    tenantId,
    customerId: 'cust_ravi',
  });

  it('allows Farmer to create Cow Milk and Buffalo Milk with custom costs', async () => {
    // 1. Create Cow Milk (₹60/L)
    const cowCode = `COW_TEST_${Date.now()}`;
    const cowReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        name: 'Pure Desi Cow Milk',
        code: cowCode,
        pricePerUnit: 60.0,
        unit: 'L',
        description: 'Fresh A2 Cow Milk',
      }),
    });

    const cowRes = await createProduct(cowReq);
    const cowJson = await cowRes.json();
    expect(cowRes.status).toBe(200);
    expect(cowJson.success).toBe(true);
    expect(cowJson.product.pricePerUnit).toBe(60.0);

    // 2. Create Buffalo Milk with null cost (unpriced/variable)
    const bufCode = `BUF_TEST_${Date.now()}`;
    const bufReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        name: 'Rich Buffalo Milk',
        code: bufCode,
        pricePerUnit: null,
        unit: 'L',
      }),
    });

    const bufRes = await createProduct(bufReq);
    const bufJson = await bufRes.json();
    expect(bufRes.status).toBe(200);
    expect(bufJson.success).toBe(true);
    expect(bufJson.product.pricePerUnit).toBeNull();
  });

  it('allows Farmer to update product cost or make it null if they want', async () => {
    const milkCode = `A2_COST_${Date.now()}`;
    // Create initially with ₹70
    const createReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        name: 'A2 Organic Milk',
        code: milkCode,
        pricePerUnit: 70.0,
      }),
    });
    const createRes = await createProduct(createReq);
    const createJson = await createRes.json();
    const prodId = createJson.product.id;

    // 1. Update cost to ₹75
    const patchReq1 = new NextRequest('http://localhost:3000/api/products', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        productId: prodId,
        pricePerUnit: 75.0,
      }),
    });
    const patchRes1 = await updateProductCost(patchReq1);
    const patchJson1 = await patchRes1.json();
    expect(patchRes1.status).toBe(200);
    expect(patchJson1.product.pricePerUnit).toBe(75.0);

    // 2. Update cost to NULL (make it null as requested)
    const patchReq2 = new NextRequest('http://localhost:3000/api/products', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        productId: prodId,
        pricePerUnit: null,
      }),
    });
    const patchRes2 = await updateProductCost(patchReq2);
    const patchJson2 = await patchRes2.json();
    expect(patchRes2.status).toBe(200);
    expect(patchJson2.product.pricePerUnit).toBeNull();
  });

  it('prevents Customers from updating milk product costs', async () => {
    const patchReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${customerSession}`,
      },
      body: JSON.stringify({
        code: 'COW',
        pricePerUnit: 1.0, // Malicious customer attempting to set price to ₹1
      }),
    });
    const patchRes = await updateProductCost(patchReq);
    expect(patchRes.status).toBe(403);
  });

  it('rejects negative milk costs with HTTP 400', async () => {
    const patchReq = new NextRequest('http://localhost:3000/api/products', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${farmerSession}`,
      },
      body: JSON.stringify({
        code: 'COW',
        pricePerUnit: -50.0,
      }),
    });
    const patchRes = await updateProductCost(patchReq);
    expect(patchRes.status).toBe(400);
  });
});
