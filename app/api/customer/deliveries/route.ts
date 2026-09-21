import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/customer/deliveries?month=9&year=2026
 *
 * Returns a full daily consumption calendar view for the authenticated client.
 * Strictly scoped to the session's own customerId — no cross-client access.
 *
 * Returns:
 *  - dailyEntries: one entry per calendar day for the requested month
 *  - summary: total taken, not-taken, litres consumed, billing value
 *  - pausePeriods: approved vacation/pause ranges
 *  - subscription: active subscription details
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();

    // Parse requested month/year (default to current month)
    const requestedMonth = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : now.getMonth() + 1;
    const requestedYear = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : now.getFullYear();

    // ── Customer privacy: strictly lock to the authenticated customer ────────
    let targetCustomerId: string | null = null;

    if (session.role === 'CUSTOMER') {
      // Customers can ONLY see their own data
      targetCustomerId = session.customerId || null;

      // If no customerId in session, resolve via user_id lookup
      if (!targetCustomerId && session.userId) {
        const lookup = await query<{ id: string }>(
          `SELECT id FROM customer_profiles WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
          [session.userId, session.tenantId]
        );
        if (lookup.rows.length > 0) {
          targetCustomerId = lookup.rows[0].id;
        }
      }

      // Block any attempt to view another customer's data
      const queryCustomerId = searchParams.get('customerId');
      if (queryCustomerId && targetCustomerId && queryCustomerId !== targetCustomerId) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You cannot view other clients' delivery data." },
          { status: 403 }
        );
      }
    } else {
      // Farmers/admins can query a specific customer
      targetCustomerId = searchParams.get('customerId') || session.customerId || null;
    }

    if (!targetCustomerId) {
      return NextResponse.json({ success: false, error: 'Customer identifier is required' }, { status: 400 });
    }

    // ── Date range for the requested month ───────────────────────────────────
    const lastDay = new Date(requestedYear, requestedMonth, 0).getDate();
    const startDate = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}-01`;
    const endDate = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];

    // ── 1. Fetch customer profile & subscription ─────────────────────────────
    const custRes = await query<{
      id: string;
      name: string;
      milk_type: string;
      daily_quantity: string;
      delivery_address: string;
      farmer_name: string;
    }>(
      `SELECT c.id, u.name, c.milk_type, c.daily_quantity, c.delivery_address,
              fu.name as farmer_name
       FROM customer_profiles c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN farmer_profiles f ON c.farmer_id = f.id
       LEFT JOIN users fu ON f.user_id = fu.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [targetCustomerId, session.tenantId]
    );

    if (custRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const cust = custRes.rows[0];

    const subRes = await query<{
      quantity: string;
      price_per_unit: string;
      product_name: string;
      frequency: string;
      status: string;
    }>(
      `SELECT s.quantity, p.price_per_unit, p.name as product_name, s.frequency, s.status
       FROM subscriptions s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.customer_id = $1 AND s.tenant_id = $2
       ORDER BY s.created_at DESC LIMIT 1`,
      [targetCustomerId, session.tenantId]
    );

    const sub = subRes.rows[0] || null;
    const dailyQty = parseFloat(cust.daily_quantity) || (sub ? parseFloat(sub.quantity) : 1.0);
    const pricePerUnit = sub ? parseFloat(sub.price_per_unit || '0') : 0;

    // ── 2. Fetch delivery records for the month ──────────────────────────────
    const delRes = await query<{
      id: string;
      date: string;
      scheduled_quantity: string;
      delivered_quantity: string;
      price_per_unit: string;
      status: string;
      notes: string | null;
    }>(
      `SELECT id, date, scheduled_quantity, delivered_quantity, price_per_unit, status, notes
       FROM delivery_records
       WHERE customer_id = $1 AND tenant_id = $2 AND date >= $3 AND date <= $4
       ORDER BY date ASC`,
      [targetCustomerId, session.tenantId, startDate, endDate]
    );

    const deliveryByDate = new Map<string, typeof delRes.rows[0]>();
    for (const d of delRes.rows) {
      deliveryByDate.set(d.date, d);
    }

    // ── 3. Fetch approved pause/vacation periods for the month ───────────────
    const pauseRes = await query<{
      start_date: string;
      end_date: string;
      reason: string;
      status: string;
    }>(
      `SELECT start_date, end_date, reason, status
       FROM pause_requests
       WHERE customer_id = $1 AND tenant_id = $2
         AND status = 'APPROVED'
         AND start_date <= $4 AND end_date >= $3
       ORDER BY start_date ASC`,
      [targetCustomerId, session.tenantId, startDate, endDate]
    );

    // Build pause date set for quick lookup
    const pausedDates = new Set<string>();
    const pausePeriods = pauseRes.rows.map((p) => ({
      startDate: p.start_date,
      endDate: p.end_date,
      reason: p.reason,
    }));
    for (const pause of pauseRes.rows) {
      const cur = new Date(pause.start_date);
      const end = new Date(pause.end_date);
      while (cur <= end) {
        pausedDates.add(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
      }
    }

    // ── 4. Build daily entry for each calendar day ───────────────────────────
    type DayStatus = 'DELIVERED' | 'PARTIAL' | 'SKIPPED' | 'NOT_DELIVERED' | 'EXTRA' | 'DISPUTED' | 'EXPECTED' | 'PAUSED' | 'FUTURE';

    interface DailyEntry {
      date: string;
      dayOfWeek: string;
      dayNumber: number;
      scheduledQty: number;
      takenQty: number;
      pricePerUnit: number;
      dailyAmount: number;
      status: DayStatus;
      notes: string | null;
      isPaused: boolean;
      isFuture: boolean;
      isToday: boolean;
      deliveryId: string | null;
    }

    const days: DailyEntry[] = [];
    const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${requestedYear}-${String(requestedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const rec = deliveryByDate.get(dateStr);
      const isPaused = pausedDates.has(dateStr);
      const isFuture = dateStr > todayStr;
      const isToday = dateStr === todayStr;
      const weekDay = new Date(dateStr).getDay();

      let status: DayStatus;
      let takenQty = 0;
      let schedQty = dailyQty;
      let unitPrice = pricePerUnit;

      if (rec) {
        takenQty = parseFloat(rec.delivered_quantity) || 0;
        schedQty = parseFloat(rec.scheduled_quantity) || dailyQty;
        unitPrice = parseFloat(rec.price_per_unit) || pricePerUnit;
        status = rec.status as DayStatus;
        if (rec.status === 'SKIPPED' && isPaused) status = 'PAUSED';
      } else if (isPaused) {
        status = 'PAUSED';
        takenQty = 0;
      } else if (isFuture) {
        status = 'FUTURE';
        takenQty = 0;
      } else {
        status = 'EXPECTED';
        takenQty = 0;
      }

      days.push({
        date: dateStr,
        dayOfWeek: DAY_NAMES[weekDay],
        dayNumber: d,
        scheduledQty: schedQty,
        takenQty,
        pricePerUnit: unitPrice,
        dailyAmount: parseFloat((takenQty * unitPrice).toFixed(2)),
        status,
        notes: rec?.notes || null,
        isPaused,
        isFuture,
        isToday,
        deliveryId: rec?.id || null,
      });
    }

    // ── 5. Compute monthly summary ────────────────────────────────────────────
    const pastDays = days.filter((d) => !d.isFuture);
    const takenDays = pastDays.filter((d) => ['DELIVERED', 'EXTRA', 'PARTIAL'].includes(d.status)).length;
    const notTakenDays = pastDays.filter((d) => ['SKIPPED', 'NOT_DELIVERED', 'PAUSED'].includes(d.status)).length;
    const totalLitres = days.reduce((sum, d) => sum + d.takenQty, 0);
    const totalBilling = days.reduce((sum, d) => sum + d.dailyAmount, 0);
    const scheduledLitres = pastDays.reduce((sum, d) => sum + d.scheduledQty, 0);

    return NextResponse.json({
      success: true,
      customer: {
        id: cust.id,
        name: cust.name,
        milkType: cust.milk_type,
        dailyQuantity: dailyQty,
        farmerName: cust.farmer_name,
      },
      subscription: sub
        ? {
            productName: sub.product_name,
            quantity: parseFloat(sub.quantity),
            pricePerUnit: parseFloat(sub.price_per_unit),
            frequency: sub.frequency,
            status: sub.status,
          }
        : null,
      month: requestedMonth,
      year: requestedYear,
      totalDays: lastDay,
      dailyEntries: days,
      pausePeriods,
      summary: {
        takenDays,
        notTakenDays,
        pendingDays: pastDays.filter((d) => d.status === 'EXPECTED').length,
        totalLitres: parseFloat(totalLitres.toFixed(2)),
        scheduledLitres: parseFloat(scheduledLitres.toFixed(2)),
        totalBilling: parseFloat(totalBilling.toFixed(2)),
        averageDailyLitres: takenDays > 0 ? parseFloat((totalLitres / takenDays).toFixed(2)) : 0,
      },
    });
  } catch (error: unknown) {
    console.error('[Customer Deliveries API Error]', error);
    return NextResponse.json({ success: false, error: 'Service temporarily unavailable' }, { status: 503 });
  }
}
