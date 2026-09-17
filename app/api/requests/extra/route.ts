import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

// GET: List extra milk requests
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');
    const store = getStore();

    let list = store.extraMilkRequests;
    if (customerId) {
      list = list.filter((r) => r.customerId === customerId);
    }
    if (status) {
      list = list.filter((r) => r.status === status);
    }

    return NextResponse.json({ success: true, requests: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch extra milk requests';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: Customer requests extra milk
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, date, requestedQuantity, reason } = body;

    if (!customerId || !date || !requestedQuantity) {
      return NextResponse.json(
        { success: false, error: 'Customer ID, date, and requested quantity are required' },
        { status: 400 }
      );
    }

    const store = getStore();
    const request = store.requestExtraMilk({
      customerId,
      date,
      requestedQuantity: parseFloat(requestedQuantity),
      reason: reason || 'Customer extra milk request',
    });

    return NextResponse.json({ success: true, request });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to submit extra milk request';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// PATCH: Farmer reviews (approves or rejects) extra milk request
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { requestId, action, reviewedBy, note } = body;

    if (!requestId || !action || !['APPROVED', 'REJECTED'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid requestId and action (APPROVED or REJECTED) are required' },
        { status: 400 }
      );
    }

    const store = getStore();
    const updated = store.reviewExtraMilkRequest({
      requestId,
      action: action as 'APPROVED' | 'REJECTED',
      reviewedBy: reviewedBy || 'Farmer Suresh Patel',
      note,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to review extra milk request';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
