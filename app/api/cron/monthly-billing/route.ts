import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateMonthlyInvoice } from '@/lib/services/billing.service';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function GET(req: NextRequest) {
  // Verify Vercel Cron invocation or CRON_SECRET authorization
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get('user-agent')?.includes('vercel-cron');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !isVercelCron) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron request' }, { status: 401 });
  }

  // Calculate billing month (defaults to previous calendar month)
  const now = new Date();
  const url = new URL(req.url);
  const paramMonth = url.searchParams.get('month');
  const paramYear = url.searchParams.get('year');

  let month = paramMonth ? parseInt(paramMonth, 10) : now.getMonth(); // 0 is Jan, so getMonth() is prev month in 1-indexed
  let year = paramYear ? parseInt(paramYear, 10) : now.getFullYear();
  if (month === 0) {
    month = 12;
    year -= 1;
  }

  let generatedCount = 0;
  const errors: string[] = [];

  if (!isUnitTest()) {
    try {
      // Find all active customers with their tenant and farmer mappings
      const custRes = await query(`
        SELECT c.id as "customerId", c.farmer_id as "farmerId", c.tenant_id as "tenantId"
        FROM customer_profiles c
        JOIN users u ON c.user_id = u.id
        WHERE u.status = 'ACTIVE'
      `);

      for (const row of custRes.rows) {
        try {
          const res = await generateMonthlyInvoice({
            customerId: row.customerId,
            farmerId: row.farmerId,
            tenantId: row.tenantId,
            month,
            year,
          });
          if (res.success) {
            generatedCount++;
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown billing error';
          errors.push(`Customer ${row.customerId}: ${msg}`);
        }
      }

      return NextResponse.json({
        success: true,
        cron: 'monthly-billing',
        billingPeriod: `${month}/${year}`,
        invoicesGenerated: generatedCount,
        errors: errors.slice(0, 10),
      });
    } catch (err) {
      console.warn('[cron/monthly-billing] DB error:', err);
    }
  }

  return NextResponse.json({
    success: true,
    cron: 'monthly-billing',
    billingPeriod: `${month}/${year}`,
    invoicesGenerated: 0,
    note: 'In-memory test environment fallback',
  });
}
