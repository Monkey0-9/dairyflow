import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { enforceCustomerOwnership } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/statement
 * Accounting-grade itemized statement endpoint.
 * Returns regular milk, extra milk, vacation credits, dispute adjustments, payments, and net balance.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);

    const customerId = searchParams.get('customerId') || session?.customerId;
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId required' }, { status: 400 });
    }

    // Role and ownership enforcement
    if (session && session.role === 'CUSTOMER') {
      const ownershipViolation = enforceCustomerOwnership(session, customerId);
      if (ownershipViolation) return ownershipViolation;
    }

    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-31`;

    // 1. Fetch deliveries from PostgreSQL
    let deliveries: Array<{ date: string; status: string; qty: number; rate: number }> = [];
    try {
      const delRes = await query(
        `SELECT date, status, delivered_quantity::float as qty, price_per_unit::float as rate
         FROM delivery_records
         WHERE customer_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date ASC`,
        [customerId, startStr, endStr]
      );
      deliveries = delRes.rows as unknown as Array<{ date: string; status: string; qty: number; rate: number }>;
    } catch {
      const store = getStore();
      const stDeliveries = Array.from(store.deliveryRecords.values()).filter(
        (d) => d.customerId === customerId && d.date >= startStr && d.date <= endStr
      );
      deliveries = stDeliveries.map((d) => ({
        date: d.date,
        status: d.status,
        qty: d.deliveredQuantity,
        rate: d.pricePerUnit,
      }));
    }

    let regularLiters = 0;
    let regularAmount = 0;
    let extraLiters = 0;
    let extraAmount = 0;
    let skippedDays = 0;

    for (const d of deliveries) {
      if (d.status === 'EXTRA') {
        extraLiters += d.qty;
        extraAmount += d.qty * d.rate;
      } else if (d.status === 'SKIPPED') {
        skippedDays += 1;
      } else if (d.status === 'DELIVERED' || d.status === 'PARTIAL') {
        regularLiters += d.qty;
        regularAmount += d.qty * d.rate;
      }
    }

    // 2. Fetch dispute adjustments
    let disputeAdjustments = 0;
    try {
      const dispRes = await query(
        `SELECT COALESCE(SUM(adjusted_amount::float), 0) as "totalAdjusted"
         FROM disputes
         WHERE customer_id = $1 AND date >= $2 AND date <= $3 AND status = 'RESOLVED'`,
        [customerId, startStr, endStr]
      );
      disputeAdjustments = dispRes.rows[0]?.totalAdjusted || 0;
    } catch {
      // ignore
    }

    const grossTotal = Math.max(0, regularAmount + extraAmount - disputeAdjustments);

    // 3. Fetch payments
    let payments: Array<{ id: string; amount: number; method: string; date: string; ref: string }> = [];
    let totalPaid = 0;
    try {
      const payRes = await query(
        `SELECT id, amount::float, method, paid_at as date, transaction_ref as ref
         FROM payments
         WHERE customer_id = $1 AND status = 'SUCCESS'`,
        [customerId]
      );
      payments = payRes.rows as unknown as Array<{ id: string; amount: number; method: string; date: string; ref: string }>;
      totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    } catch {
      const store = getStore();
      const stPayments = store.payments.filter((p) => p.customerId === customerId && p.status === 'SUCCESS');
      payments = stPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.paymentMethod || 'UPI',
        date: p.paidAt,
        ref: p.transactionRef,
      }));
      totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    }

    const outstandingBalance = Math.max(0, grossTotal - totalPaid);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return NextResponse.json({
      success: true,
      statement: {
        customerId,
        billingCycle: `${monthNames[month - 1]} ${year}`,
        period: { from: startStr, to: endStr },
        lineItems: [
          {
            description: `Regular Daily Milk (${regularLiters.toFixed(1)} L)`,
            quantity: regularLiters,
            amount: Math.round(regularAmount),
          },
          ...(extraLiters > 0
            ? [
                {
                  description: `Extra Milk Orders (${extraLiters.toFixed(1)} L)`,
                  quantity: extraLiters,
                  amount: Math.round(extraAmount),
                },
              ]
            : []),
          ...(disputeAdjustments > 0
            ? [
                {
                  description: 'Dispute / Missed Drop Adjustments',
                  quantity: 0,
                  amount: -Math.round(disputeAdjustments),
                },
              ]
            : []),
        ],
        summary: {
          regularMilkAmount: Math.round(regularAmount),
          extraMilkAmount: Math.round(extraAmount),
          disputeAdjustments: Math.round(disputeAdjustments),
          skippedDaysCount: skippedDays,
          grossTotal: Math.round(grossTotal),
          totalPaid: Math.round(totalPaid),
          outstandingBalance: Math.round(outstandingBalance),
          status: outstandingBalance <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
        },
        payments,
        dueDate: new Date(year, month, 5).toISOString().slice(0, 10),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate statement';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
