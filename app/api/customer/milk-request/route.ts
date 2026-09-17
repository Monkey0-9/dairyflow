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

    const { date, requestedQuantity, reason } = body;

    if (!date || requestedQuantity === undefined || requestedQuantity === null) {
      return NextResponse.json(
        { success: false, error: 'date and requestedQuantity are required' },
        { status: 400 }
      );
    }

    const qty = Number(requestedQuantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: 'requestedQuantity must be a positive number' },
        { status: 400 }
      );
    }

    const request = store.requestExtraMilk({
      customerId: cust.id,
      date,
      requestedQuantity: qty,
      reason: reason || 'Extra milk requested by customer',
      farmerId: cust.farmerId || store.farmer.id,
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

    const requests = store.extraMilkRequests.filter((m) => m.customerId === customerId);
    return NextResponse.json({ success: true, requests });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
