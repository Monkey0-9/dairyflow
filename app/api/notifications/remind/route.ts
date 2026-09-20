import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { query } from '@/lib/db';
import { sendPaymentReminder } from '@/lib/notify/provider';
import { ReminderLang } from '@/lib/reminders';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/notifications/remind — Vercel Cron entry point for automated
 * overdue reminders. Requires CRON_SECRET bearer auth. Idempotent: one
 * automated reminder per invoice per day (notifications-table guard).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');
  if (!process.env.CRON_SECRET || (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secretParam !== process.env.CRON_SECRET)) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron caller' }, { status: 401 });
  }

  const lang = (url.searchParams.get('lang') || 'en') as ReminderLang;
  const dryRun = url.searchParams.get('dryRun') === 'true';

  let rows: { invoiceId: string; tenantId: string; userId: string; customerName: string; phone: string | null; outstandingAmount: number }[] = [];
  try {
    const res = await query(
      `SELECT i.id as "invoiceId", i.tenant_id as "tenantId", u.id as "userId",
              u.name as "customerName", u.phone,
              i.outstanding_amount::float as "outstandingAmount"
       FROM invoices i
       JOIN customer_profiles c ON i.customer_id = c.id
       JOIN users u ON c.user_id = u.id
       WHERE i.outstanding_amount > 0 AND i.status != 'PAID' AND i.due_date <= NOW()
       ORDER BY i.due_date ASC
       LIMIT 500`
    );
    rows = res.rows as typeof rows;
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'DB query failed' },
      { status: 500 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const guard = await query(
        `SELECT id FROM notifications
         WHERE user_id = $1 AND title = 'Auto payment reminder'
           AND message LIKE $2 AND created_at::date = $3::date
         LIMIT 1`,
        [row.userId, `%${row.invoiceId}%`, today]
      ).catch(() => ({ rows: [] as unknown[] }));
      if (guard.rows.length > 0 || !row.phone) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        sent += 1;
        continue;
      }
      const result = await sendPaymentReminder({
        phone: row.phone,
        customerName: row.customerName,
        amount: row.outstandingAmount,
        lang,
      });
      const ok = result.whatsapp.success || result.sms.success;
      await query(
        `INSERT INTO notifications (id, tenant_id, user_id, title, message, type)
         VALUES ($1, $2, $3, 'Auto payment reminder', $4, $5)`,
        [
          `CRON_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          row.tenantId,
          row.userId,
          `[${row.invoiceId}] Overdue milk bill reminder :: ${ok ? 'sent' : 'FAILED'}`,
          ok ? 'WARNING' : 'URGENT',
        ]
      ).catch(() => undefined);
      if (ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ success: true, dryRun, checked: rows.length, sent, failed, skipped });
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const authHeader = req.headers.get('authorization');
    const isCron = authHeader && process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!session && !isCron) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { invoiceId, customerId, lang } = body;

    const dispatched: Array<{
      invoiceId: string;
      customerName: string;
      phone: string;
      amount: number;
      whatsapp?: boolean;
      sms?: boolean;
    }> = [];

    // DB-first branch
    if (!isUnitTest()) {
      try {
        let sql = `
          SELECT i.id as "invoiceId", i.outstanding_amount::float as "outstandingAmount",
                 u.name as "customerName", u.phone, i.tenant_id as "tenantId"
          FROM invoices i
          JOIN customer_profiles c ON i.customer_id = c.id
          JOIN users u ON c.user_id = u.id
          WHERE i.outstanding_amount > 0 AND i.status != 'PAID'
        `;
        const params: unknown[] = [];
        if (invoiceId) {
          params.push(invoiceId);
          sql += ` AND i.id = $${params.length}`;
        } else if (customerId) {
          params.push(customerId);
          sql += ` AND i.customer_id = $${params.length}`;
        } else if (session?.farmerId) {
          params.push(session.farmerId);
          sql += ` AND i.farmer_id = $${params.length}`;
        }

        const res = await query(sql, params);
        for (const row of res.rows) {
          const result = await sendPaymentReminder({
            phone: row.phone,
            customerName: row.customerName,
            amount: row.outstandingAmount,
            lang: (lang as ReminderLang) || 'en',
          });

          dispatched.push({
            invoiceId: row.invoiceId,
            customerName: row.customerName,
            phone: row.phone,
            amount: row.outstandingAmount,
            whatsapp: result.whatsapp?.success,
            sms: result.sms?.success,
          });
        }

        if (dispatched.length > 0) {
          return NextResponse.json({
            success: true,
            source: 'db',
            remindersSent: dispatched.length,
            details: dispatched,
          });
        }
      } catch (err) {
        console.warn('[notifications/remind] DB fetch failed, falling back to store:', err);
      }
    }

    // In-memory fallback — unit tests only, never production (no fake phones).
    if (!isUnitTest()) {
      return NextResponse.json({ success: true, source: 'db', remindersSent: dispatched.length, details: dispatched });
    }
    const store = getStore();
    let invs = store.invoices.filter((i) => i.outstandingAmount > 0 && i.status !== 'PAID');
    if (invoiceId) {
      invs = invs.filter((i) => i.id === invoiceId);
    } else if (customerId) {
      invs = invs.filter((i) => i.customerId === customerId);
    }

    for (const inv of invs) {
      const cust = store.customers.find((c) => c.id === inv.customerId);
      const user = cust ? store.users.find((u) => u.id === cust.userId) : undefined;
      const phone = user?.phone;
      if (!phone) continue; // FR-NOT: never send to hardcoded demo numbers
      const name = cust?.name || user?.name || 'Customer';

      const result = await sendPaymentReminder({
        phone,
        customerName: name,
        amount: inv.outstandingAmount,
        lang: (lang as ReminderLang) || 'en',
      });

      dispatched.push({
        invoiceId: inv.id,
        customerName: name,
        phone,
        amount: inv.outstandingAmount,
        whatsapp: result.whatsapp?.success,
        sms: result.sms?.success,
      });
    }

    return NextResponse.json({
      success: true,
      source: 'store',
      remindersSent: dispatched.length,
      details: dispatched,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
