import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getUnifiedRequests, handleRequestAction } from '@/lib/services/request.service';
import { isUuid, resolveDbScope } from '@/lib/db-scope';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);

    const farmerId =
      searchParams.get('farmerId') ||
      session?.farmerId ||
      (session?.role === 'FARMER' ? getStore().farmer.id : getStore().farmer.id);

    if (!isUnitTest()) {
      try {
        // Seed ids (farmer_01 / F001) never exist in PostgreSQL — resolve the
        // real farmer so reviews list actual pending requests.
        let dbFarmerId: string | undefined = isUuid(farmerId) ? farmerId : undefined;
        if (!dbFarmerId) {
          try {
            dbFarmerId = (await resolveDbScope(session)).farmerId;
          } catch {
            dbFarmerId = undefined;
          }
        }
        const unified = await getUnifiedRequests({ farmerId: dbFarmerId });
        const pauses = unified.filter((r) => r.type === 'PAUSE');
        const extras = unified.filter((r) => r.type === 'EXTRA_MILK');
        const qty = unified.filter((r) => r.type === 'QUANTITY_CHANGE');
        // Map into the legacy store shapes the farmer UI consumes.
        const pauseRequests = pauses.map((r) => ({
          id: r.id,
          customerId: r.customerId,
          customerName: r.customerName,
          customerCode: r.customerPhone || '',
          customerPhone: r.customerPhone,
          farmerId: r.farmerId,
          startDate: r.startDate,
          endDate: r.endDate,
          reason: r.details,
          status: r.status,
          createdAt: r.createdAt,
          reviewedAt: r.reviewedAt,
        }));
        const milkRequests = extras.map((r) => ({
          id: r.id,
          customerId: r.customerId,
          customerName: r.customerName,
          customerCode: r.customerPhone || '',
          customerPhone: r.customerPhone,
          farmerId: r.farmerId,
          date: r.startDate,
          requestedQuantity: r.quantity,
          reason: r.details,
          status: r.status,
          createdAt: r.createdAt,
          reviewedAt: r.reviewedAt,
        }));
        const pendingCount =
          pauses.filter((r) => r.status === 'PENDING').length +
          extras.filter((r) => r.status === 'PENDING').length +
          qty.filter((r) => r.status === 'PENDING').length;
        return NextResponse.json({
          success: true,
          source: 'db',
          vacationPauses: pauses,
          extraMilkRequests: extras,
          quantityChanges: qty,
          requests: unified,
          pauseRequests,
          milkRequests,
          disputes: [],
          pendingCount,
        });
      } catch (err) {
        console.error('[farmer/requests] DB read failed:', err);
        return NextResponse.json({ success: false, error: 'Failed to load requests from database' }, { status: 500 });
      }
    }

    const store = getStore();
    const requests = store.getFarmerRequests(farmerId);
    return NextResponse.json({
      success: true,
      source: 'store',
      ...requests,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const body = await req.json();

    const { requestId, type, action, note, rejectionReason, reviewedBy } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { success: false, error: 'requestId and action (APPROVED | REJECTED) are required' },
        { status: 400 }
      );
    }

    const normalized = String(action).toUpperCase();
    const serviceAction = normalized === 'APPROVE' || normalized === 'APPROVED' ? 'APPROVE' : normalized === 'REJECT' || normalized === 'REJECTED' ? 'REJECT' : null;
    if (!serviceAction) {
      return NextResponse.json(
        { success: false, error: 'action must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    if (!isUnitTest()) {
      try {
        const result = await handleRequestAction(requestId, serviceAction, {
          actorId: session?.userId || 'user_farmer',
          actorRole: session?.role || 'FARMER',
          tenantId: isUuid(session?.tenantId) ? session.tenantId : '',
          notes: rejectionReason || note,
        });
        if (result.success) {
          return NextResponse.json({ success: true, requestId, action: serviceAction, source: 'db' });
        }
        if (result.error && result.error.startsWith('Request not found')) {
          return NextResponse.json({ success: false, error: result.error }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: result.error || 'Failed to review request' }, { status: 400 });
      } catch (err) {
        // Production: report loudly instead of a store-only false success.
        console.error('[farmer/requests] DB review failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to review request';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }

    const store = getStore();
    const reviewerName = reviewedBy || session?.name || 'Suresh Patel (Farmer)';

    if (type === 'PAUSE' || requestId.startsWith('req_pause_')) {
      const result = store.reviewPauseRequest({
        requestId,
        action,
        reviewedBy: reviewerName,
        rejectionReason: rejectionReason || note,
      });

      if (!result) {
        return NextResponse.json({ success: false, error: 'Pause request not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, request: result, source: 'store' });
    } else if (type === 'MILK' || requestId.startsWith('req_extra_')) {
      const result = store.reviewExtraMilkRequest({
        requestId,
        action: action as 'APPROVED' | 'REJECTED',
        reviewedBy: reviewerName,
        note: rejectionReason || note,
      });

      if (!result) {
        return NextResponse.json({ success: false, error: 'Milk request not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, request: result, source: 'store' });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown request type. Specify type: "PAUSE" or "MILK"' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
