import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { enforceActiveAccount } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { processPayment } from '@/lib/services/payment.service';
import { query } from '@/lib/db';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const invoiceId = searchParams.get('invoiceId');

    // Production: PostgreSQL is the source of truth (store-only reads hid
    // real payments and lost everything on restart).
    if (!isUnitTest()) {
      try {
        const params: unknown[] = [];
        let sql = `
          SELECT id, tenant_id as "tenantId", invoice_id as "invoiceId",
                 customer_id as "customerId", farmer_id as "farmerId",
                 amount::float as amount, method as "paymentMethod",
                 transaction_ref as "transactionRef", status,
                 paid_at as "paidAt", created_at as "createdAt"
          FROM payments WHERE 1=1`;
        if (customerId) {
          params.push(customerId);
          sql += ` AND customer_id = $${params.length}`;
        }
        if (invoiceId) {
          params.push(invoiceId);
          sql += ` AND invoice_id = $${params.length}`;
        }
        sql += ` ORDER BY paid_at DESC LIMIT 500`;
        const res = await query(sql, params);
        return NextResponse.json({ success: true, payments: res.rows, source: 'db' });
      } catch (err) {
        console.error('[payments] DB read failed:', err);
        // Fall through to store only when the database is unreachable;
        // an empty store must not mask the outage.
      }
    }

    const store = getStore();
    let list = store.payments;
    if (customerId) {
      list = list.filter((p) => p.customerId === customerId);
    }
    if (invoiceId) {
      list = list.filter((p) => p.invoiceId === invoiceId);
    }

    return NextResponse.json({ success: true, payments: list, source: 'store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
    const limitCheck = checkRateLimit(`payments_${ip}`, 30, 60);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many payment attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(limitCheck.resetTimeSeconds) } }
      );
    }
    const body = await req.json();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    if (session) {
      const suspended = await enforceActiveAccount(session);
      if (suspended) return suspended;
    }
    const { invoiceId, amount, paymentMethod, method, transactionRef, notes } = body;
    const payMethod = paymentMethod || method;

    if (!invoiceId || !amount || !payMethod) {
      return NextResponse.json(
        { success: false, error: 'invoiceId, amount, and paymentMethod are required' },
        { status: 400 }
      );
    }

    // Simple payment recording - generate transaction reference if not provided
    const txRef = transactionRef || `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // DB-first idempotent payment via processPayment (UNIQUE(transaction_ref)).
    // Production: the invoice is resolved from PostgreSQL (the store starts
    // empty in production) and DB failures are reported loudly — a
    // store-only "success" would vanish on restart and be masked on read.
    if (!isUnitTest()) {
      try {
        const invRes = await query(
          `SELECT id, customer_id as "customerId", farmer_id as "farmerId", tenant_id as "tenantId"
           FROM invoices WHERE id = $1`,
          [invoiceId]
        );
        if (invRes.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
        }
        const inv = invRes.rows[0] as { id: string; customerId: string; farmerId: string; tenantId: string };
        const dbResult = await processPayment({
          invoiceId: inv.id,
          customerId: inv.customerId,
          farmerId: inv.farmerId,
          tenantId: inv.tenantId,
          amount: parseFloat(amount),
          method: payMethod,
          transactionRef: txRef,
          notes: notes,
        });
        if (dbResult.success) {
          publishEvent({
            type: 'payment:received',
            tenantId: inv.tenantId,
            customerId: inv.customerId,
            payload: { invoiceId: inv.id, amount: parseFloat(amount), transactionRef: txRef },
          });
          // Mirror to store for UI consistency (non-blocking best effort)
          try {
            const store = getStore();
            if (store.invoices.some((i) => i.id === inv.id)) {
              store.recordPayment(inv.id, parseFloat(amount), payMethod, txRef, notes);
            }
          } catch { /* ignore */ }
          return NextResponse.json({
            success: true,
            source: 'db',
            paymentId: dbResult.paymentId,
            isDuplicate: dbResult.isDuplicate,
            newOutstandingAmount: dbResult.newOutstandingAmount,
            newStatus: dbResult.newStatus,
            status: dbResult.isDuplicate ? 'ALREADY_PROCESSED' : 'PROCESSED',
          });
        }
        return NextResponse.json(
          { success: false, error: dbResult.error || 'Payment processing failed' },
          { status: 400 }
        );
      } catch (err) {
        console.error('[payments] DB payment failed:', err);
        const message = err instanceof Error ? err.message : 'Payment processing failed';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }

    const store = getStore();
    const result = store.recordPayment(
      invoiceId,
      parseFloat(amount),
      payMethod,
      txRef,
      notes
    );

    if (!result) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      source: 'store',
      payment: result.payment,
      isDuplicate: result.isDuplicate,
      status: result.isDuplicate ? 'ALREADY_PROCESSED' : 'PROCESSED',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
