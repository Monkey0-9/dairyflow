import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postQuantity, GET as getQuantity } from '@/app/api/customer/quantity-request/route';

function post(body: unknown) {
  return new NextRequest('http://localhost:3000/api/customer/quantity-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('System: POST /api/customer/quantity-request', () => {
  it('rejects missing fields with 400', async () => {
    const res = await postQuantity(post({ customerId: 'cust_ravi' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it('rejects non-positive quantities with 400', async () => {
    const res = await postQuantity(
      post({ customerId: 'cust_ravi', effectiveDate: '2026-10-01', newQuantity: 0 })
    );
    expect(res.status).toBe(400);
  });

  it('creates a quantity request via store fallback in tests', async () => {
    const res = await postQuantity(
      post({ customerId: 'cust_ravi', effectiveDate: '2026-10-01', newQuantity: 2.5, reason: 'Guests' })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.request).toBeDefined();
  });

  it('rejects unknown customers with 401', async () => {
    const res = await postQuantity(
      post({ customerId: 'cust_nonexistent', effectiveDate: '2026-10-01', newQuantity: 2 })
    );
    expect(res.status).toBe(401);
  });
});

describe('System: GET /api/customer/quantity-request', () => {
  it('requires customerId with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/customer/quantity-request');
    const res = await getQuantity(req);
    expect(res.status).toBe(400);
  });

  it('lists requests for a customer', async () => {
    const req = new NextRequest('http://localhost:3000/api/customer/quantity-request?customerId=cust_ravi');
    const res = await getQuantity(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.requests)).toBe(true);
  });
});
