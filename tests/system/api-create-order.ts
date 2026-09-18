import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createOrder } from '@/app/api/payments/create-order/route';

function post(body: unknown) {
  return new NextRequest('http://localhost:3000/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('System: POST /api/payments/create-order', () => {
  const savedKeyId = process.env.RAZORPAY_KEY_ID;
  const savedSecret = process.env.RAZORPAY_KEY_SECRET;

  beforeEach(() => {
    // Force hermetic sandbox mode regardless of host env
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
  });

  afterEach(() => {
    if (savedKeyId !== undefined) process.env.RAZORPAY_KEY_ID = savedKeyId;
    if (savedSecret !== undefined) process.env.RAZORPAY_KEY_SECRET = savedSecret;
  });

  it('requires invoiceId and amount', async () => {
    const res = await createOrder(post({}));
    expect(res.status).toBe(400);
  });

  it('rejects non-positive amounts', async () => {
    const res = await createOrder(post({ invoiceId: 'inv_x', amount: -5 }));
    expect(res.status).toBe(400);
  });

  it('returns a sandbox order with encoded UPI deep-link', async () => {
    const res = await createOrder(post({ invoiceId: 'inv_2026_09_ravi', amount: 350 }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.mode).toBe('sandbox');
    expect(data.order.amount).toBe(35000);
    expect(data.order.currency).toBe('INR');
    expect(data.upi.uri.startsWith('upi://pay?')).toBe(true);
    expect(data.upi.uri).toContain('am=350.00');
    expect(data.upi.uri).toContain('cu=INR');
  });
});
