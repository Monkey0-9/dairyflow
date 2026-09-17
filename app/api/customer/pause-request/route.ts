import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const store = getStore();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const body = await req.json();

    const targetCustomerId = body.customerId || session?.customerId;
    const cust = store.customers.find(
      (c) => c.id === targetCustomerId || (session && c.userId === session.userId)
    );

    if (!cust) {
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

    const request = store.createPauseRequest({
      customerId: cust.id,
      startDate,
      endDate,
      reason: reason || 'Vacation Pause requested by customer',
      farmerId: cust.farmerId || store.farmer.id,
      subscriptionId,
    });

    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
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

    const requests = store.pauseRequests.filter((p) => p.customerId === customerId);
    return NextResponse.json({ success: true, requests });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
