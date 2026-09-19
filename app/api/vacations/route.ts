import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { query, transaction } from '@/lib/db';
import { createPauseRequest } from '@/lib/services/request.service';
import { isTestMode } from '@/lib/db-scope';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    // Production: read durable pause history from PostgreSQL.
    if (!isTestMode()) {
      try {
        const params: unknown[] = [];
        let sql = `
          SELECT id, customer_id as "customerId", farmer_id as "farmerId",
                 start_date as "startDate", end_date as "endDate",
                 reason, status, created_at as "createdAt"
          FROM pause_requests WHERE 1=1`;
        if (customerId) {
          params.push(customerId);
          sql += ` AND customer_id = $${params.length}`;
        }
        sql += ` ORDER BY created_at DESC LIMIT 200`;
        const res = await query(sql, params);
        return NextResponse.json({
          success: true,
          source: 'db',
          vacationPauses: res.rows,
          temporaryQuantityChanges: [],
        });
      } catch (err) {
        console.error('[vacations] DB read failed:', err);
        return NextResponse.json({ success: false, error: 'Failed to load vacation pauses' }, { status: 500 });
      }
    }

    const store = getStore();

    let pauses = store.vacationPauses;
    let tempChanges = store.tempQuantityChanges;

    if (customerId) {
      pauses = pauses.filter((p) => p.customerId === customerId);
      tempChanges = tempChanges.filter((t) => t.customerId === customerId);
    }

    return NextResponse.json({
      success: true,
      vacationPauses: pauses,
      temporaryQuantityChanges: tempChanges,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, customerId, startDate, endDate, reason, overrideQuantity } = body;

    if (!customerId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'customerId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Production: persist durably. PAUSE becomes an approved pause row and
    // immediately skips ledger records in range; EXTRA_QUANTITY durably
    // overrides ledger quantities in range. Both fail loudly on DB error.
    if (!isTestMode()) {
      const cust = await query(`SELECT id FROM customer_profiles WHERE id = $1`, [customerId]);
      if (cust.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }

      if (type === 'PAUSE') {
        try {
          const created = await createPauseRequest({
            customerId,
            startDate,
            endDate,
            reason: reason || 'Vacation / Out of town',
          });
          if (!created.success) {
            return NextResponse.json({ success: false, error: created.error || 'Failed to save pause' }, { status: 400 });
          }
          // Farmer-initiated pauses take effect immediately.
          await transaction(async (client) => {
            await client.query(`UPDATE pause_requests SET status = 'APPROVED', reviewed_at = NOW() WHERE id = $1`, [created.id]);
            await client.query(
              `UPDATE delivery_records SET status = 'SKIPPED', delivered_quantity = 0.0, updated_at = NOW()
               WHERE customer_id = $1 AND date >= $2 AND date <= $3`,
              [customerId, startDate, endDate]
            );
          });
          return NextResponse.json({ success: true, source: 'db', pause: { id: created.id, customerId, startDate, endDate, status: 'APPROVED' } });
        } catch (err) {
          console.error('[vacations] DB pause failed:', err);
          const message = err instanceof Error ? err.message : 'Failed to save vacation pause';
          return NextResponse.json({ success: false, error: message }, { status: 500 });
        }
      } else if (type === 'EXTRA_QUANTITY') {
        if (overrideQuantity === undefined) {
          return NextResponse.json(
            { success: false, error: 'overrideQuantity is required for extra quantity' },
            { status: 400 }
          );
        }
        try {
          const qty = parseFloat(overrideQuantity);
          if (isNaN(qty) || qty <= 0) {
            return NextResponse.json({ success: false, error: 'overrideQuantity must be positive' }, { status: 400 });
          }
          const upd = await query(
            `UPDATE delivery_records
             SET scheduled_quantity = $1, delivered_quantity = $1, status = 'EXTRA', updated_at = NOW()
             WHERE customer_id = $2 AND date >= $3 AND date <= $4 AND status NOT IN ('SKIPPED', 'DISPUTED', 'NOT_DELIVERED')`,
            [qty, customerId, startDate, endDate]
          );
          return NextResponse.json({ success: true, source: 'db', change: { customerId, startDate, endDate, overrideQuantity: qty, updated: upd.rowCount ?? 0 } });
        } catch (err) {
          console.error('[vacations] DB extra-quantity failed:', err);
          const message = err instanceof Error ? err.message : 'Failed to save quantity override';
          return NextResponse.json({ success: false, error: message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: false, error: 'Invalid type. Use PAUSE or EXTRA_QUANTITY' }, { status: 400 });
    }

    const store = getStore();

    if (type === 'PAUSE') {
      const pause = store.scheduleVacationPause(
        customerId,
        startDate,
        endDate,
        reason || 'Vacation / Out of town'
      );
      return NextResponse.json({ success: true, pause });
    } else if (type === 'EXTRA_QUANTITY') {
      if (overrideQuantity === undefined) {
        return NextResponse.json(
          { success: false, error: 'overrideQuantity is required for extra quantity' },
          { status: 400 }
        );
      }
      const change = store.scheduleTemporaryQuantity(
        customerId,
        startDate,
        endDate,
        parseFloat(overrideQuantity),
        reason || 'Guest demand'
      );
      return NextResponse.json({ success: true, change });
    }

    return NextResponse.json({ success: false, error: 'Invalid type. Use PAUSE or EXTRA_QUANTITY' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
