import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const store = getStore();
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

      return NextResponse.json({ success: true, request: result });
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

      return NextResponse.json({ success: true, request: result });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
