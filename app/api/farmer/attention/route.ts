import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getStore } from '@/lib/store';

function isUnitTest(): boolean {
  return process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'FARMER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Attention center is only accessible to farmers and admins' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const farmerId = user.farmerId || 'F001';

    if (isUnitTest()) {
      const store = getStore();
      const pauses = store.pauseRequests.filter((p) => p.status === 'PENDING');
      const extraMilk = store.extraMilkRequests.filter((e) => e.status === 'PENDING');
      const disputes = store.disputes.filter((d) => d.status === 'OPEN');
      const paymentIssues = store.invoices.filter((i) => i.outstandingAmount > 0 && i.status !== 'PAID');
      const dayLedger = store.getOrGenerateDailyLedger(targetDate);
      const deliveryExceptions = dayLedger.filter(
        (r) => r.status === 'SKIPPED' || r.status === 'NOT_DELIVERED' || r.status === 'DISPUTED'
      );

      return NextResponse.json({
        success: true,
        summary: {
          totalAttentionCount:
            pauses.length + extraMilk.length + disputes.length + paymentIssues.length + deliveryExceptions.length,
          pauseRequestsCount: pauses.length,
          extraMilkRequestsCount: extraMilk.length,
          openDisputesCount: disputes.length,
          paymentIssuesCount: paymentIssues.length,
          deliveryExceptionsCount: deliveryExceptions.length,
        },
        items: {
          pauseRequests: pauses,
          extraMilkRequests: extraMilk,
          disputes,
          paymentIssues: paymentIssues.slice(0, 10),
          deliveryExceptions,
        },
      });
    }

    // Authoritative PostgreSQL query
    const [pauseRes, extraRes, disputeRes, invoiceRes, exceptionRes] = await Promise.all([
      // 1. Pending Pause Requests
      query(
        `SELECT p.id, p.customer_id, p.start_date, p.end_date, p.reason, p.created_at, u.name as customer_name
         FROM pause_requests p
         JOIN customer_profiles c ON p.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         WHERE p.farmer_id = $1 AND p.status = 'PENDING'
         ORDER BY p.created_at DESC`,
        [farmerId]
      ),
      // 2. Pending Extra Milk Requests
      query(
        `SELECT e.id, e.customer_id, e.date, e.quantity::float, e.milk_type, e.notes, e.created_at, u.name as customer_name
         FROM extra_milk_requests e
         JOIN customer_profiles c ON e.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         WHERE e.farmer_id = $1 AND e.status = 'PENDING'
         ORDER BY e.created_at DESC`,
        [farmerId]
      ),
      // 3. Open Disputes
      query(
        `SELECT d.id, d.delivery_record_id, d.reason, d.disputed_quantity::float, d.created_at, u.name as customer_name
         FROM disputes d
         JOIN delivery_records r ON d.delivery_record_id = r.id
         JOIN customer_profiles c ON r.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         WHERE r.farmer_id = $1 AND d.status = 'OPEN'
         ORDER BY d.created_at DESC`,
        [farmerId]
      ),
      // 4. Payment Issues / Overdue Invoices
      query(
        `SELECT i.id, i.customer_id, i.month, i.year, i.total_amount::float, i.outstanding_amount::float, i.status, u.name as customer_name, u.phone as customer_phone
         FROM invoices i
         JOIN customer_profiles c ON i.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         WHERE i.farmer_id = $1 AND i.outstanding_amount > 0 AND i.status != 'PAID'
         ORDER BY i.outstanding_amount DESC
         LIMIT 15`,
        [farmerId]
      ),
      // 5. Daily Delivery Exceptions
      query(
        `SELECT r.id, r.customer_id, r.scheduled_quantity::float, r.delivered_quantity::float, r.status, r.notes, u.name as customer_name
         FROM delivery_records r
         JOIN customer_profiles c ON r.customer_id = c.id
         JOIN users u ON c.user_id = u.id
         WHERE r.farmer_id = $1 AND r.date = $2 AND (r.status = 'SKIPPED' OR r.status = 'NOT_DELIVERED' OR r.status = 'DISPUTED')`,
        [farmerId, targetDate]
      ),
    ]);

    const totalCount =
      pauseRes.rows.length +
      extraRes.rows.length +
      disputeRes.rows.length +
      invoiceRes.rows.length +
      exceptionRes.rows.length;

    return NextResponse.json({
      success: true,
      summary: {
        totalAttentionCount: totalCount,
        pauseRequestsCount: pauseRes.rows.length,
        extraMilkRequestsCount: extraRes.rows.length,
        openDisputesCount: disputeRes.rows.length,
        paymentIssuesCount: invoiceRes.rows.length,
        deliveryExceptionsCount: exceptionRes.rows.length,
      },
      items: {
        pauseRequests: pauseRes.rows,
        extraMilkRequests: extraRes.rows,
        disputes: disputeRes.rows,
        paymentIssues: invoiceRes.rows,
        deliveryExceptions: exceptionRes.rows,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch farmer attention exceptions';
    console.error('[AttentionCenter] GET error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
