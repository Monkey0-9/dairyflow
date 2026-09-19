import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { processPayment } from '@/lib/services/payment.service';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { getStore } from '@/lib/store';
import { isTestMode } from '@/lib/db-scope';
import crypto from 'crypto';

const CREDITABLE_EVENTS = new Set(['payment.captured', 'order.paid']);

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
    const limitCheck = checkRateLimit(`webhook_${ip}`, 60, 60);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many webhook deliveries. Retrying later is safe (idempotent).' },
        { status: 429, headers: { 'Retry-After': String(limitCheck.resetTimeSeconds) } }
      );
    }
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || req.headers.get('x-webhook-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_milkflow_prod_demo_key_9812';

    if (process.env.NODE_ENV === 'production' && !process.env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Server misconfigured: RAZORPAY_WEBHOOK_SECRET missing in production environment.' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'production' && !signature) {
      return NextResponse.json(
        { success: false, error: 'Missing webhook HMAC signature' },
        { status: 401 }
      );
    }

    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
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

    if (payload.event && !CREDITABLE_EVENTS.has(payload.event) && !payload.transactionRef) {
      return NextResponse.json({ success: true, status: 'IGNORED', event: payload.event });
    }

    let { transactionRef, invoiceId, amount, paymentMethod, note } = payload;

    if (!invoiceId && (payload.event === 'payment.captured' || payload.event === 'order.paid')) {
      const entity = payload.payload?.payment?.entity;
      if (entity) {
        transactionRef = entity.id;
        amount = entity.amount ? entity.amount / 100 : amount;
        paymentMethod = (entity.method || 'UPI').toUpperCase();
        invoiceId = entity.notes?.invoiceId;
        note = entity.description || 'Razorpay webhook confirmation';
      }
    }

    if (!invoiceId || !amount || !transactionRef) {
      return NextResponse.json(
        { success: false, error: 'invoiceId, amount, and transactionRef are required' },
        { status: 400 }
      );
    }

    // DB-First persistent payment processing inside transaction
    const dbInv = await query(
      `SELECT id, customer_id as "customerId", farmer_id as "farmerId", tenant_id as "tenantId" FROM invoices WHERE id = $1`,
      [invoiceId]
    );

    if (dbInv.rows.length > 0) {
      const inv = dbInv.rows[0];
      const result = await processPayment({
        invoiceId: inv.id,
        customerId: inv.customerId,
        farmerId: inv.farmerId,
        tenantId: inv.tenantId,
        amount: parseFloat(amount),
        method: paymentMethod || 'UPI',
        transactionRef,
      });

      if (isTestMode()) {
        try {
          const store = getStore();
          store.recordPayment(invoiceId, parseFloat(amount), paymentMethod || 'UPI', transactionRef, note);
        } catch { /* test store mirror */ }
      }

      return NextResponse.json({
        success: true,
        status: result.isDuplicate ? 'ALREADY_PROCESSED' : 'PROCESSED',
        message: result.isDuplicate ? `Transaction ${transactionRef} was already processed.` : 'Payment recorded successfully',
        transactionRef,
        newOutstandingAmount: result.newOutstandingAmount,
        newStatus: result.newStatus,
      });
    }

    if (isTestMode()) {
      const store = getStore();
      const result = store.recordPayment(invoiceId, parseFloat(amount), paymentMethod || 'UPI', transactionRef, note);
      if (result) {
        return NextResponse.json({
          success: true,
          status: result.isDuplicate ? 'ALREADY_PROCESSED' : 'PROCESSED',
          message: result.isDuplicate ? `Transaction ${transactionRef} was already processed.` : 'Payment recorded successfully',
          payment: result.payment,
        });
      }
    }

    return NextResponse.json({ success: false, error: 'Invoice not found in database' }, { status: 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Webhook error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
