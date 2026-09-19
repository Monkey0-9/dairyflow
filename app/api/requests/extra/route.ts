import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { createExtraMilkRequest, getUnifiedRequests, handleRequestAction } from '@/lib/services/request.service';
import { isTestMode } from '@/lib/db-scope';

// GET: List extra milk requests
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    // Production: durable read from PostgreSQL mapped to the store shape.
    if (!isTestMode()) {
      try {
        const unified = await getUnifiedRequests({ customerId: customerId || undefined });
        let list = unified
          .filter((r) => r.type === 'EXTRA_MILK')
          .map((r) => ({
            id: r.id,
            customerId: r.customerId,
            farmerId: r.farmerId,
            customerName: r.customerName,
            date: r.startDate,
            requestedQuantity: r.quantity,
            reason: r.details,
            status: r.status,
            createdAt: r.createdAt,
            reviewedAt: r.reviewedAt,
          }));
        if (status) list = list.filter((r) => r.status === status);
        return NextResponse.json({ success: true, requests: list, source: 'db' });
      } catch (err) {
        console.error('[requests/extra] DB read failed:', err);
        return NextResponse.json({ success: false, error: 'Failed to load extra milk requests' }, { status: 500 });
      }
    }

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

    // Production: durable insert (UUID PKs) — loud failure, no false success.
    if (!isTestMode()) {
      const qty = parseFloat(requestedQuantity);
      if (isNaN(qty) || qty <= 0) {
        return NextResponse.json({ success: false, error: 'requestedQuantity must be a positive number' }, { status: 400 });
      }
      const created = await createExtraMilkRequest({
        customerId,
        date,
        quantity: qty,
        notes: reason || 'Customer extra milk request',
      });
      if (!created.success) {
        const notFound = created.error === 'Customer not found';
        return NextResponse.json(
          { success: false, error: created.error || 'Failed to submit extra milk request' },
          { status: notFound ? 404 : 400 }
        );
      }
      return NextResponse.json({ success: true, source: 'db', request: { id: created.id, customerId, date, requestedQuantity: qty, status: 'PENDING' } }, { status: 201 });
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
    console.error('[requests/extra] POST failed:', error);
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

    // Production: durable review via transactional service; loud on failure.
    if (!isTestMode()) {
      const result = await handleRequestAction(
        requestId,
        action === 'APPROVED' ? 'APPROVE' : 'REJECT',
        { actorId: 'user_farmer', actorRole: 'FARMER', tenantId: '', notes: note }
      );
      if (!result.success) {
        const notFound = result.error?.startsWith('Request not found');
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to review request' },
          { status: notFound ? 404 : 400 }
        );
      }
      void reviewedBy;
      return NextResponse.json({ success: true, source: 'db', request: { id: requestId, status: action } });
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
    console.error('[requests/extra] PATCH failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
