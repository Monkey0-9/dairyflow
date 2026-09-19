import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'MANAGER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { date, reason, shift } = await req.json();

    if (!date || !reason) {
      return NextResponse.json({ success: false, error: 'date and reason are required.' }, { status: 400 });
    }

    const farmerId = auth.user.farmerId || 'F001';

    // Automatically transition all EXPECTED deliveries on this date/shift to SKIPPED with closure notes
    await query('BEGIN');

    const updateSql = `
      UPDATE delivery_records
      SET status = 'SKIPPED', delivered_quantity = 0.0, notes = $1, updated_at = NOW()
      WHERE farmer_id = $2 AND date = $3 AND status = 'EXPECTED'
    `;
    const updateParams: unknown[] = [`Operational Closure: ${reason}`, farmerId, date];

    const updatedDeliveries = await query(updateSql, updateParams);

    // Record closure in activity_events
    await query(
      `INSERT INTO activity_events (id, tenant_id, actor_id, actor_role, action, description, metadata, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'OPERATIONAL_CLOSURE', $4, $5, NOW())`,
      [
        auth.user.tenantId,
        auth.user.userId,
        auth.user.role,
        `Operational closure recorded for date ${date}: ${reason}`,
        JSON.stringify({ date, reason, shift, affectedDeliveries: updatedDeliveries.rowCount }),
      ]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Operational closure applied for ${date}. ${updatedDeliveries.rowCount || 0} deliveries marked as SKIPPED.`,
      affectedDeliveries: updatedDeliveries.rowCount,
    });
  } catch (err: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : 'Failed to apply operational closure';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
