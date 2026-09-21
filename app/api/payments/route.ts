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
    const status = searchParams.get('status');

    // Production: PostgreSQL is the source of truth (store-only reads hid
    // real payments and lost everything on restart).
    if (!isUnitTest()) {
      try {
        const params: unknown[] = [];
        let sql = `
          SELECT p.id, p.tenant_id as "tenantId", p.invoice_id as "invoiceId",
                 p.customer_id as "customerId", p.farmer_id as "farmerId",
                 p.amount::float as amount, p.method as "paymentMethod",
                 p.transaction_ref as "transactionRef", p.status,
                 p.paid_at as "paidAt", p.created_at as "createdAt",
                 c.name as "customerName", c.customer_code as "customerCode",
                 inv.invoice_number as "invoiceNumber"
          FROM payments p
          LEFT JOIN customer_profiles c ON p.customer_id = c.id
          LEFT JOIN invoices inv ON p.invoice_id = inv.id
          WHERE 1=1`;
        if (customerId) {
          params.push(customerId);
          sql += ` AND p.customer_id = $${params.length}`;
        }
        if (invoiceId) {
          params.push(invoiceId);
          sql += ` AND p.invoice_id = $${params.length}`;
        }
        if (status) {
          params.push(status);
          sql += ` AND p.status = $${params.length}`;
        }
        sql += ` ORDER BY (CASE WHEN p.status = 'PENDING' THEN 0 ELSE 1 END), p.created_at DESC LIMIT 500`;
        const res = await query(sql, params);
        return NextResponse.json({ success: true, payments: res.rows, source: 'db' });
      } catch (err) {
        console.error('[payments] DB read failed:', err);
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
    if (status) {
      list = list.filter((p) => p.status === status);
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
    const { invoiceId, amount, paymentMethod, method, transactionRef, notes, status: requestedStatus } = body;
    const payMethod = paymentMethod || method;

    if (!invoiceId || !amount || !payMethod) {
      return NextResponse.json(
        { success: false, error: 'invoiceId, amount, and paymentMethod are required' },
        { status: 400 }
      );
    }

    // Generate transaction reference if not provided
    const txRef = (transactionRef || '').trim() || `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const isPendingSubmission = requestedStatus === 'PENDING';

    // 1. Client Pending UTR Verification submission
    if (isPendingSubmission) {
      if (!isUnitTest()) {
        try {
          let invRes = await query(
            `SELECT id, customer_id as "customerId", farmer_id as "farmerId", tenant_id as "tenantId"
             FROM invoices WHERE id = $1`,
            [invoiceId]
          );
          if (invRes.rows.length === 0) {
            const custId = body.customerId || session?.customerId;
            if (custId) {
              invRes = await query(
                `SELECT id, customer_id as "customerId", farmer_id as "farmerId", tenant_id as "tenantId"
                 FROM invoices WHERE customer_id = $1 ORDER BY year DESC, month DESC LIMIT 1`,
                [custId]
              );
            }
          }
          if (invRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Invoice not found for payment' }, { status: 404 });
          }
          const inv = invRes.rows[0] as { id: string; customerId: string; farmerId: string; tenantId: string };
          const paymentId = crypto.randomUUID();

          await query(
            `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, method, transaction_ref, status, paid_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', NOW(), NOW())
             ON CONFLICT (transaction_ref) DO UPDATE SET amount = EXCLUDED.amount, status = 'PENDING'`,
            [paymentId, inv.tenantId, inv.id, inv.customerId, inv.farmerId, parseFloat(amount), payMethod, txRef]
          );

          publishEvent({
            type: 'payment:submitted',
            tenantId: inv.tenantId,
            customerId: inv.customerId,
            payload: { paymentId, invoiceId: inv.id, amount: parseFloat(amount), transactionRef: txRef, status: 'PENDING' },
          });

          return NextResponse.json({
            success: true,
            source: 'db',
            paymentId,
            status: 'PENDING',
            message: 'Payment verification submitted to administrator for confirmation',
          });
        } catch (err) {
          console.error('[payments] Failed to record pending payment in DB:', err);
          const message = err instanceof Error ? err.message : 'Error submitting payment';
          return NextResponse.json({ success: false, error: message }, { status: 500 });
        }
      }

      // Unit test / store fallback
      const store = getStore();
      const invoice = store.invoices.find((i) => i.id === invoiceId);
      if (!invoice) {
        return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
      }
      const payment = {
        id: `pay_pending_${Date.now()}`,
        tenantId: store.tenantId,
        invoiceId,
        customerId: invoice.customerId,
        customerName: invoice.customerName,
        farmerId: invoice.farmerId,
        amount: parseFloat(amount),
        paymentMethod: payMethod,
        transactionRef: txRef,
        receiptNumber: `PEND-${Date.now()}`,
        paidAt: new Date().toISOString(),
        note: notes,
        status: 'PENDING' as const,
      };
      store.payments.unshift(payment);
      return NextResponse.json({
        success: true,
        source: 'store',
        payment,
        status: 'PENDING',
      });
    }

    // 2. Direct payment settlement via processPayment
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
          // Mirror to store for UI consistency
          try {
            const store = getStore();
            if (store.invoices.some((i) => i.id === inv.id)) {
              store.recordPayment(inv.id, parseFloat(amount), payMethod, txRef, notes);
            }
          } catch (storeErr) {
            console.error('[payments] Failed to mirror payment to in-memory store:', storeErr);
          }
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

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { paymentId, action, rejectionReason } = body;

    if (!paymentId || !action || !['CONFIRM', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'paymentId and a valid action (CONFIRM or REJECT) are required' },
        { status: 400 }
      );
    }

    if (!isUnitTest()) {
      try {
        const payRes = await query(
          `SELECT id, invoice_id as "invoiceId", customer_id as "customerId", farmer_id as "farmerId",
                  tenant_id as "tenantId", amount::float as amount, status, transaction_ref as "transactionRef"
           FROM payments WHERE id = $1`,
          [paymentId]
        );

        if (payRes.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Payment record not found' }, { status: 404 });
        }

        const pay = payRes.rows[0];

        if (action === 'CONFIRM') {
          // Update payment status
          await query(
            `UPDATE payments SET status = 'SUCCESS', paid_at = NOW() WHERE id = $1`,
            [paymentId]
          );

          // Update target invoice with row-level lock and 2-decimal precision
          const invRes = await query(
            `SELECT id, total_amount::float as "totalAmount", paid_amount::float as "paidAmount"
             FROM invoices WHERE id = $1 FOR UPDATE`,
            [pay.invoiceId]
          );

          let newOutstanding = 0;
          let newStatus = 'PAID';

          if (invRes.rows.length > 0) {
            const invoice = invRes.rows[0];
            const newPaid = Math.round((invoice.paidAmount + pay.amount) * 100) / 100;
            newOutstanding = Math.max(0, Math.round((invoice.totalAmount - newPaid) * 100) / 100);
            newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';

            await query(
              `UPDATE invoices
               SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = NOW()
               WHERE id = $4`,
              [newPaid, newOutstanding, newStatus, pay.invoiceId]
            );
          }

          publishEvent({
            type: 'payment:received',
            tenantId: pay.tenantId,
            customerId: pay.customerId,
            payload: {
              paymentId,
              invoiceId: pay.invoiceId,
              amount: pay.amount,
              transactionRef: pay.transactionRef,
              status: 'CONFIRMED',
            },
          });

          return NextResponse.json({
            success: true,
            status: 'SUCCESS',
            message: 'Payment verified and settled successfully by administrator',
            newOutstandingAmount: newOutstanding,
            newStatus,
          });
        }

        // Reject action
        await query(
          `UPDATE payments SET status = 'FAILED' WHERE id = $1`,
          [paymentId]
        );

        publishEvent({
          type: 'payment:rejected',
          tenantId: pay.tenantId,
          customerId: pay.customerId,
          payload: {
            paymentId,
            invoiceId: pay.invoiceId,
            rejectionReason: rejectionReason || 'Payment reference not found on bank/UPI statement',
          },
        });

        return NextResponse.json({
          success: true,
          status: 'REJECTED',
          message: 'Payment verification rejected by administrator',
        });
      } catch (err) {
        console.error('[payments] PATCH action failed in DB:', err);
        const message = err instanceof Error ? err.message : 'Failed to update payment status';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }

    // In-memory fallback
    const store = getStore();
    const pay = store.payments.find((p) => p.id === paymentId);
    if (!pay) {
      return NextResponse.json({ success: false, error: 'Payment not found in store' }, { status: 404 });
    }

    if (action === 'CONFIRM') {
      pay.status = 'SUCCESS';
      const inv = store.invoices.find((i) => i.id === pay.invoiceId);
      if (inv) {
        inv.paidAmount = parseFloat((inv.paidAmount + pay.amount).toFixed(2));
        inv.outstandingAmount = Math.max(0, parseFloat((inv.totalAmount - inv.paidAmount).toFixed(2)));
        inv.status = inv.outstandingAmount <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      }
      return NextResponse.json({ success: true, status: 'SUCCESS' });
    } else {
      pay.status = 'FAILED';
      return NextResponse.json({ success: true, status: 'REJECTED' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
