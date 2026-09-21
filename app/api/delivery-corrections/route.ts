import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import {
  applyDeliveryCorrection,
  getDeliveryCorrections,
  AUTHORIZED_CORRECTION_ROLES,
} from '@/lib/services/delivery-correction.service';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || undefined;
    const customerId = searchParams.get('customerId') || undefined;
    const farmerId = searchParams.get('farmerId') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const corrections = await getDeliveryCorrections({
      tenantId: session?.tenantId,
      farmerId,
      customerId,
      date,
      limit,
    });

    return NextResponse.json({ success: true, corrections });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch delivery corrections';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
    const limitCheck = checkRateLimit(`delivery_correction_${ip}`, 30, 60);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many correction requests. Please try again later.' },
        { status: 429 }
      );
    }

    let session = await getSessionUser(req);
    if (!session) {
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      session = decodeSession(token) || null;
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const role = (session.role || '').toUpperCase();
    if (!AUTHORIZED_CORRECTION_ROLES.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: Role ${role} is not authorized to apply post-day-close delivery corrections (FR-DEL-009).`,
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { deliveryRecordId, correctedQuantity, correctedStatus, reason } = body;

    if (!deliveryRecordId) {
      return NextResponse.json(
        { success: false, error: 'deliveryRecordId is required' },
        { status: 400 }
      );
    }

    if (correctedQuantity === undefined || correctedQuantity === null || isNaN(Number(correctedQuantity))) {
      return NextResponse.json(
        { success: false, error: 'Valid numeric correctedQuantity is required' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Detailed reason (at least 5 characters) is mandatory for audit logging' },
        { status: 400 }
      );
    }

    const result = await applyDeliveryCorrection({
      deliveryRecordId,
      correctedQuantity: parseFloat(correctedQuantity),
      correctedStatus,
      reason: reason.trim(),
      authorizedBy: session.userId,
      authorizedRole: role,
      tenantId: session.tenantId,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      correction: result.correction,
      auditBlockId: result.auditBlock?.id,
      message: 'Post-close delivery correction applied and cryptographically recorded.',
    });
  } catch (err: unknown) {
    console.error('[POST /api/delivery-corrections] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
