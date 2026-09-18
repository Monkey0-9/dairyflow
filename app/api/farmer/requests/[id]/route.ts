import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { handleRequestAction } from '@/lib/services/request.service';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

function toServiceAction(action: string): 'APPROVE' | 'REJECT' | null {
  const a = action.toUpperCase();
  if (a === 'APPROVE' || a === 'APPROVED') return 'APPROVE';
  if (a === 'REJECT' || a === 'REJECTED') return 'REJECT';
  return null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const body = await req.json();

    const resolvedParams = await Promise.resolve(context.params);
    const requestId = resolvedParams.id;
    const { type, action, note, rejectionReason, reviewedBy } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action (APPROVED | REJECTED) is required' },
        { status: 400 }
      );
    }

    const serviceAction = toServiceAction(action);
    if (!serviceAction) {
      return NextResponse.json(
        { success: false, error: 'action must be APPROVED or REJECTED' },
        { status: 400 }
      );
    }

    // DB-first: transactional reviewRequest inside BEGIN...COMMIT
    if (!isUnitTest()) {
      try {
        const result = await handleRequestAction(requestId, serviceAction, {
          actorId: session?.userId || 'user_farmer',
          actorRole: session?.role || 'FARMER',
          tenantId: session?.tenantId || 'tenant_greenvalley',
          notes: rejectionReason || note,
        });
        if (result.success) {
          publishEvent({
            type: serviceAction === 'APPROVE' ? 'request:approved' : 'request:rejected',
            tenantId: session?.tenantId,
            payload: { requestId, action: serviceAction, requestType: type },
          });
          return NextResponse.json({ success: true, requestId, action: serviceAction, source: 'db' });
        }
        // "Request not found" in DB -> fall through to store (seed ids like req_pause_*)
        if (result.error && !result.error.startsWith('Request not found')) {
          return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }
      } catch (err) {
        console.warn('[farmer/requests/[id]] DB review failed, falling back to store:', err);
      }
    }

    const store = getStore();
    const reviewerName = reviewedBy || session?.name || 'Suresh Patel (Farmer)';

    const isPause =
      type === 'PAUSE' ||
      requestId.startsWith('req_pause_') ||
      store.pauseRequests.some((p) => p.id === requestId);

    if (isPause) {
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
    } else {
      const result = store.reviewExtraMilkRequest({
        requestId,
        action,
        reviewedBy: reviewerName,
        note: rejectionReason || note,
      });

      if (!result) {
        return NextResponse.json({ success: false, error: 'Milk request not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, request: result, source: 'store' });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
