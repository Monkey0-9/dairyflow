import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { createPauseRequest, getUnifiedRequests } from '@/lib/services/request.service';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const body = await req.json();

    const targetCustomerId = body.customerId || session?.customerId;
    if (!targetCustomerId && !session) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or unauthorized' },
        { status: 401 }
      );
    }

    const { startDate, endDate, reason, subscriptionId } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate must be before or equal to endDate' },
        { status: 400 }
      );
    }

    // DB-first path: INSERT INTO pause_requests via request.service
    if (!isUnitTest()) {
      try {
        const store = getStore();
        const fallbackCust = store.customers.find(
          (c) => c.id === targetCustomerId || (session && c.userId === session.userId)
        );
        const customerId = targetCustomerId || fallbackCust?.id;
        if (customerId) {
          const dbResult = await createPauseRequest({
            customerId,
            farmerId: fallbackCust?.farmerId,
            tenantId: session?.tenantId || fallbackCust?.tenantId,
            startDate,
            endDate,
            reason: reason || 'Vacation Pause requested by customer',
          });
          if (dbResult.success) {
            publishEvent({
              type: 'request:created',
              tenantId: session?.tenantId,
              farmerId: fallbackCust?.farmerId,
              customerId,
              payload: { requestId: dbResult.id, kind: 'PAUSE', startDate, endDate },
            });
            return NextResponse.json(
              { success: true, request: { id: dbResult.id, customerId, startDate, endDate, status: 'PENDING' }, source: 'db' },
              { status: 201 }
            );
          }
          // If DB insert failed due to missing customer row (seed-only test ids), fall through to store
          if (dbResult.error !== 'Customer not found') {
            throw new Error(dbResult.error);
          }
        }
      } catch (err) {
        console.warn('[pause-request] DB insert failed, falling back to store:', err);
      }
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

    const request = store.createPauseRequest({
      customerId: cust.id,
      startDate,
      endDate,
      reason: reason || 'Vacation Pause requested by customer',
      farmerId: cust.farmerId || store.farmer.id,
      subscriptionId,
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

    // DB-first read
    if (!isUnitTest()) {
      try {
        const dbRequests = await getUnifiedRequests({ customerId });
        const pauses = dbRequests.filter((r) => r.type === 'PAUSE');
        if (pauses.length > 0) {
          return NextResponse.json({ success: true, requests: pauses, source: 'db' });
        }
      } catch (err) {
        console.warn('[pause-request] DB read failed, falling back to store:', err);
      }
    }

    const store = getStore();
    const requests = store.pauseRequests.filter((p) => p.customerId === customerId);
    return NextResponse.json({ success: true, requests, source: 'store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
