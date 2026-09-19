import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['FARMER', 'OWNER', 'ACCOUNTANT', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { farmerId, month, year } = await req.json();

    if (!farmerId || typeof month !== 'number' || typeof year !== 'number') {
      return NextResponse.json(
        { success: false, error: 'farmerId, month, and year are required.' },
        { status: 400 }
      );
    }

    const tenantId = auth.user.tenantId;

    // Check if month closing already exists
    const checkRes = await query(
      `SELECT id, status FROM month_closings WHERE farmer_id = $1 AND month = $2 AND year = $3`,
      [farmerId, month, year]
    );

    if (checkRes.rows.length > 0 && checkRes.rows[0].status === 'FINALIZED') {
      return NextResponse.json(
        { success: false, error: `Month ${month}/${year} is already finalized and locked.` },
        { status: 400 }
      );
    }

    // Insert or update month_closings
    const res = await query(
      `INSERT INTO month_closings (id, tenant_id, farmer_id, month, year, status, closed_by, closed_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'FINALIZED', $5, NOW())
       ON CONFLICT (farmer_id, month, year) DO UPDATE SET status = 'FINALIZED', closed_by = $5, closed_at = NOW()
       RETURNING id, month, year, status, closed_by as "closedBy", closed_at as "closedAt"`,
      [tenantId, farmerId, month, year, auth.user.name || auth.user.userId]
    );

    return NextResponse.json({
      success: true,
      message: `Month ${month}/${year} successfully finalized and locked.`,
      monthClosing: res.rows[0],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to finalize month';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const farmerId = searchParams.get('farmerId') || auth.user.farmerId;

  try {
    const res = await query(
      `SELECT id, tenant_id as "tenantId", farmer_id as "farmerId", month, year, status,
              closed_by as "closedBy", closed_at as "closedAt"
       FROM month_closings
       WHERE farmer_id = $1
       ORDER BY year DESC, month DESC`,
      [farmerId]
    );

    return NextResponse.json({ success: true, monthClosings: res.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch month closings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
