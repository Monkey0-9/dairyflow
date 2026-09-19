import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { isTestMode } from '@/lib/db-scope';
import {
  lookupQrToken,
  confirmDeliveryViaQrScan,
  regenerateQrToken,
  revokeQrToken,
} from '@/lib/services/qr.service';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing QR token parameter' }, { status: 400 });
    }

    const result = await lookupQrToken(token);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    // Tenant isolation verification
    if (user.role === 'FARMER' && result.data?.farmerId && result.data.farmerId !== user.farmerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Customer belongs to another farmer' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, customer: result.data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action field' }, { status: 400 });
    }

    if (action === 'scan') {
      // Must be FARMER or ADMIN
      if (user.role !== 'FARMER' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only delivery farmers can scan to confirm delivery' },
          { status: 403 }
        );
      }

      const { token, date, quantity, bottlesReturned } = body;
      if (!token || !date) {
        return NextResponse.json(
          { success: false, error: 'Missing token or delivery date' },
          { status: 400 }
        );
      }

      const confirmRes = await confirmDeliveryViaQrScan({
        token,
        farmerId: await resolveScanFarmerId(user),
        tenantId: user.tenantId,
        date,
        quantity: typeof quantity === 'number' ? quantity : undefined,
        bottlesReturned: typeof bottlesReturned === 'number' ? bottlesReturned : undefined,
      });

      if (!confirmRes.success) {
        return NextResponse.json({ success: false, error: confirmRes.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Delivery confirmed via QR scan',
        data: confirmRes,
      });
    }

    if (action === 'regenerate') {
      const { customerId } = body;
      const targetCustomerId = customerId || user.customerId;

      // Customer can only regenerate their own QR; Farmer can regenerate their customers' QR
      if (user.role === 'CUSTOMER' && targetCustomerId !== user.customerId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Cannot regenerate QR for another customer' },
          { status: 403 }
        );
      }

      const regenRes = await regenerateQrToken({
        customerId: targetCustomerId,
        tenantId: user.tenantId,
        actorId: user.userId,
        actorRole: user.role,
      });

      if (!regenRes.success) {
        return NextResponse.json({ success: false, error: regenRes.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'QR token regenerated successfully',
        token: regenRes.newToken,
      });
    }

    if (action === 'revoke') {
      const { customerId } = body;
      if (!customerId) {
        return NextResponse.json({ success: false, error: 'Missing customerId' }, { status: 400 });
      }

      if (user.role !== 'FARMER' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Only farmers or administrators can revoke QR codes' },
          { status: 403 }
        );
      }

      const revokeRes = await revokeQrToken({
        customerId,
        tenantId: user.tenantId,
        actorId: user.userId,
        actorRole: user.role,
      });

      if (!revokeRes.success) {
        return NextResponse.json({ success: false, error: revokeRes.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'QR token revoked successfully' });
    }

    return NextResponse.json({ success: false, error: `Unrecognized action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// Seed ids (F001) never exist in PostgreSQL: resolve the farmer's real
// profile id from the database so QR scans actually confirm deliveries.
// Test suites use seed sessions + the in-memory store, so legacy behavior
// is preserved there.
async function resolveScanFarmerId(user: { userId: string; farmerId?: string; tenantId: string }): Promise<string> {
  if (isTestMode()) return user.farmerId || 'F001';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (user.farmerId && UUID_RE.test(user.farmerId)) {
    try {
      const r = await query(`SELECT id FROM farmer_profiles WHERE id = $1`, [user.farmerId]);
      if (r.rows.length > 0) return user.farmerId;
    } catch { /* fall through */ }
  }
  try {
    const byUser = await query(`SELECT id FROM farmer_profiles WHERE user_id = $1`, [user.userId]);
    if (byUser.rows.length > 0) return byUser.rows[0].id as string;
    const byTenant = await query(
      `SELECT id FROM farmer_profiles WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [user.tenantId]
    );
    if (byTenant.rows.length > 0) return byTenant.rows[0].id as string;
  } catch { /* fall through */ }
  return user.farmerId || '';
}
