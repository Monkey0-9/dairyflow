import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getStore } from '@/lib/store';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function GET(req: NextRequest) {
  // Verify Vercel Cron invocation or CRON_SECRET authorization
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get('user-agent')?.includes('vercel-cron');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron request' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  const summary: {
    date: string;
    pendingRequestsCount: number;
    activeDeliveriesExpected: number;
    unpaidInvoicesCount: number;
  } = {
    date: today,
    pendingRequestsCount: 0,
    activeDeliveriesExpected: 0,
    unpaidInvoicesCount: 0,
  };

  if (!isUnitTest()) {
    try {
      // 1. Check pending pause / extra / quantity change requests
      const reqRes = await query(
        `SELECT COUNT(*)::int as count FROM (
           SELECT id FROM pause_requests WHERE status = 'PENDING'
           UNION ALL
           SELECT id FROM extra_milk_requests WHERE status = 'PENDING'
           UNION ALL
           SELECT id FROM quantity_change_requests WHERE status = 'PENDING'
         ) as pending`
      );
      summary.pendingRequestsCount = reqRes.rows[0]?.count || 0;

      // 2. Check deliveries expected today
      const delRes = await query(
        `SELECT COUNT(*)::int as count FROM delivery_records WHERE date = $1 AND status = 'EXPECTED'`,
        [today]
      );
      summary.activeDeliveriesExpected = delRes.rows[0]?.count || 0;

      // 3. Check unpaid invoices
      const invRes = await query(
        `SELECT COUNT(*)::int as count FROM invoices WHERE outstanding_amount > 0 AND status != 'PAID'`
      );
      summary.unpaidInvoicesCount = invRes.rows[0]?.count || 0;

      return NextResponse.json({
        success: true,
        cron: 'daily-check',
        timestamp: new Date().toISOString(),
        summary,
        source: 'db',
      });
    } catch (err) {
      console.warn('[cron/daily-check] DB execution failed, falling back to store:', err);
    }
  }

  const store = getStore();
  summary.pendingRequestsCount =
    store.pauseRequests.filter((p) => p.status === 'PENDING').length +
    store.extraMilkRequests.filter((e) => e.status === 'PENDING').length;
  summary.unpaidInvoicesCount = store.invoices.filter(
    (i) => i.outstandingAmount > 0 && i.status !== 'PAID'
  ).length;

  return NextResponse.json({
    success: true,
    cron: 'daily-check',
    timestamp: new Date().toISOString(),
    summary,
    source: 'store',
  });
}
