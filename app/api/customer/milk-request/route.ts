import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { createExtraMilkRequest, getUnifiedRequests } from '@/lib/services/request.service';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const body = await req.json();

    const targetCustomerId = body.customerId || session?.customerId;

    const { date, endDate, requestedQuantity, quantity, reason, milkType, notes } = body;
    const qtyRaw = requestedQuantity ?? quantity;

    if (!date || qtyRaw === undefined || qtyRaw === null) {
      return NextResponse.json(
        { success: false, error: 'date and requestedQuantity are required' },
        { status: 400 }
      );
    }

    const qty = Number(qtyRaw);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: 'requestedQuantity must be a positive number' },
        { status: 400 }
      );
    }

    // A date range (extraEnd in the portal) expands to one durable request
    // per day so no selected day is silently dropped.
    const dates: string[] = [date];
    if (endDate && typeof endDate === 'string' && endDate > date) {
      const cursor = new Date(date + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      let guard = 0;
      while (cursor < end && guard < 30) {
        cursor.setDate(cursor.getDate() + 1);
        guard += 1;
        dates.push(cursor.toISOString().slice(0, 10));
      }
      if (endDate < dates[dates.length - 1]) {
        return NextResponse.json({ success: false, error: 'Date range is too large (max 31 days).' }, { status: 400 });
      }
    }

    // DB-first path. Production: failures are loud (503), never a fake 201.
    let dbWriteFailed: unknown = null;
    if (!isUnitTest()) {
      try {
        const store = getStore();
        const fallbackCust = targetCustomerId
          ? store.customers.find(
              (c) => c.id === targetCustomerId || (session && c.userId === session.userId)
            )
          : undefined;
        const customerId = targetCustomerId || fallbackCust?.id;
        if (customerId) {
          const created: { id: string; date: string }[] = [];
          for (const d of dates) {
            const dbResult = await createExtraMilkRequest({
              customerId,
              farmerId: fallbackCust?.farmerId,
              tenantId: session?.tenantId || fallbackCust?.tenantId,
              date: d,
              milkType: milkType || 'Cow',
              quantity: qty,
              notes: notes || reason || 'Extra milk requested by customer',
            });
            if (!dbResult.success || !dbResult.id) {
              if (dbResult.error === 'Customer not found') {
                return NextResponse.json({ success: false, error: 'Customer not found or unauthorized' }, { status: 404 });
              }
              throw new Error(dbResult.error || `Failed to save extra milk request for ${d}`);
            }
            created.push({ id: dbResult.id, date: d });
          }
          publishEvent({
            type: 'request:created',
            tenantId: session?.tenantId,
            farmerId: fallbackCust?.farmerId,
            customerId,
            payload: { requestIds: created.map((c) => c.id), kind: 'EXTRA_MILK', dates, quantity: qty },
          });
          return NextResponse.json(
            {
              success: true,
              request: { id: created[0].id, customerId, date, quantity: qty, status: 'PENDING' },
              requests: created.map((c) => ({ id: c.id, customerId, date: c.date, quantity: qty, status: 'PENDING' })),
              source: 'db',
            },
            { status: 201 }
          );
        }
      } catch (err) {
        dbWriteFailed = err;
        console.error('[milk-request] DB insert failed:', err);
      }
    }

    // Production: the DB write failed — report honestly.
    if (!isUnitTest() && dbWriteFailed) {
      const message = dbWriteFailed instanceof Error ? dbWriteFailed.message : 'Request could not be saved. Please retry.';
      return NextResponse.json({ success: false, error: message }, { status: 503 });
    }

    const store = getStore();
    const cust = store.customers.find(
      (c) => c.id === targetCustomerId || (session && c.userId === session.userId)
    );

    if (!cust) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or unauthorized' },
        { status: 401 }
      );
    }

    const request = store.requestExtraMilk({
      customerId: cust.id,
      date,
      requestedQuantity: qty,
      reason: reason || 'Extra milk requested by customer',
      farmerId: cust.farmerId || store.farmer.id,
    });

    return NextResponse.json({ success: true, request, source: 'store' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId') || session?.customerId;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId required' },
        { status: 400 }
      );
    }

    if (!isUnitTest()) {
      try {
        const dbRequests = await getUnifiedRequests({ customerId });
        const extras = dbRequests.filter((r) => r.type === 'EXTRA_MILK');
        if (extras.length > 0) {
          return NextResponse.json({ success: true, requests: extras, source: 'db' });
        }
      } catch (err) {
        console.warn('[milk-request] DB read failed, falling back to store:', err);
      }
    }

    const store = getStore();
    const requests = store.extraMilkRequests.filter((m) => m.customerId === customerId);
    return NextResponse.json({ success: true, requests, source: 'store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
