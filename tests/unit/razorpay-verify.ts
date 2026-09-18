import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyRazorpayPaymentSignature } from '@/lib/services/payment.service';

describe('Unit: Razorpay callback signature verification', () => {
  const secret = 'test_key_secret_123';

  it('accepts a correctly computed signature', () => {
    const orderId = 'order_Test123';
    const paymentId = 'pay_Test456';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    expect(
      verifyRazorpayPaymentSignature({ orderId, paymentId, signature, keySecret: secret })
    ).toBe(true);
  });

  it('rejects a tampered signature', () => {
    expect(
      verifyRazorpayPaymentSignature({
        orderId: 'order_Test123',
        paymentId: 'pay_Test456',
        signature: '0'.repeat(64),
        keySecret: secret,
      })
    ).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    const signature = crypto
      .createHmac('sha256', 'wrong_secret')
      .update('order_A|pay_B')
      .digest('hex');
    expect(
      verifyRazorpayPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature, keySecret: secret })
    ).toBe(false);
  });

  it('fails closed when fields are missing', () => {
    expect(
      verifyRazorpayPaymentSignature({ orderId: '', paymentId: 'pay_B', signature: 'abc', keySecret: secret })
    ).toBe(false);
    expect(
      verifyRazorpayPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: '' })
    ).toBe(false);
  });
});
