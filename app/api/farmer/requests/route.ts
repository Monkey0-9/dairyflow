  import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);

    const farmerId = searchParams.get('farmerId') || (session?.role === 'FARMER' ? store.farmer.id : store.farmer.id);

    const requests = store.getFarmerRequests(farmerId);
    return NextResponse.json({
      success: true,
      ...requests,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const store = getStore();
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

      return NextResponse.json({ success: true, request: result });
    } else if (type === 'MILK' || requestId.startsWith('req_extra_')) {
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

    return NextResponse.json(
      { success: false, error: 'Unknown request type. Specify type: "PAUSE" or "MILK"' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
