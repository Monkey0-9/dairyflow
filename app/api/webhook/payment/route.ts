import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import crypto from 'crypto';

// Secret key for payment webhook HMAC verification
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_milkflow_prod_demo_key_9812';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('x-webhook-signature');

    // Signature verification (if signature header provided)
    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        return NextResponse.json(
          { success: false, error: 'Invalid webhook HMAC signature' },
          { status: 401 }
        );
      }
    }

    const payload = JSON.parse(rawBody);
    const { event, transactionRef, invoiceId, amount, paymentMethod, note } = payload;

    if (!invoiceId || !amount || !transactionRef) {
      return NextResponse.json(
        { success: false, error: 'invoiceId, amount, and transactionRef are required' },
        { status: 400 }
      );
    }

    const store = getStore();

    // Idempotent processing check
    const result = store.recordPayment(
      invoiceId,
      parseFloat(amount),
      paymentMethod || 'UPI',
      transactionRef,
      note || 'Webhook payment confirmation'
    );

    if (!result) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    if (result.isDuplicate) {
      return NextResponse.json({
        success: true,
        status: 'ALREADY_PROCESSED',
        message: `Transaction ${transactionRef} was already processed. Duplicate ignored safely.`,
        payment: result.payment,
      });
    }

    return NextResponse.json({
      success: true,
      status: 'PROCESSED',
      payment: result.payment,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
