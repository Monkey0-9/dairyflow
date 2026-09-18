import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { processPayment } from '@/lib/services/payment.service';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    let list = store.payments;
    if (customerId) {
      list = list.filter((p) => p.customerId === customerId);
    }

    return NextResponse.json({ success: true, payments: list, source: 'store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { invoiceId, amount, paymentMethod, method, transactionRef, note } = body;
    const payMethod = paymentMethod || method;

    if (!invoiceId || !amount || !payMethod) {
      return NextResponse.json(
        { success: false, error: 'invoiceId, amount, and paymentMethod are required' },
        { status: 400 }
      );
    }

    const txRef = transactionRef || `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // DB-first idempotent payment via processPayment (UNIQUE(transaction_ref))
    if (!isUnitTest()) {
      try {
        const store = getStore();
        const inv = store.invoices.find((i) => i.id === invoiceId);
        if (inv) {
          const dbResult = await processPayment({
            invoiceId,
            customerId: inv.customerId,
            farmerId: inv.farmerId,
            tenantId: session?.tenantId || inv.tenantId || store.tenantId,
            amount: parseFloat(amount),
            method: payMethod,
            transactionRef: txRef,
          });
          if (dbResult.success) {
            publishEvent({
              type: 'payment:received',
              tenantId: session?.tenantId,
              customerId: inv.customerId,
              payload: { invoiceId, amount: parseFloat(amount), transactionRef: txRef },
            });
            // Mirror to store for UI consistency (non-blocking best effort)
            try {
              store.recordPayment(invoiceId, parseFloat(amount), payMethod, txRef, note);
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
          if (dbResult.error && dbResult.error !== 'Invoice not found') {
            throw new Error(dbResult.error);
          }
        }
      } catch (err) {
        console.warn('[payments] DB payment failed, falling back to store:', err);
      }
    }

    const store = getStore();
    const result = store.recordPayment(
      invoiceId,
      parseFloat(amount),
      payMethod,
      txRef,
      note
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
