import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query, transaction } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'MANAGER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { date, reason, shift } = await req.json();

    if (!date || !reason) {
      return NextResponse.json({ success: false, error: 'date and reason are required.' }, { status: 400 });
    }

    const tenantId = auth.user.tenantId;

    let farmerId = auth.user.farmerId;
    if (!farmerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmerId)) {
      const fp = await query(`SELECT id FROM farmer_profiles WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
      if (fp.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No farmer profile found for this dairy.' }, { status: 400 });
      }
      farmerId = fp.rows[0].id as string;
    }

    // Automatically transition all EXPECTED deliveries on this date/shift to SKIPPED with closure notes
    const affectedCount = await transaction(async (client) => {
      const updateSql = `
        UPDATE delivery_records
        SET status = 'SKIPPED', delivered_quantity = 0.0, notes = $1, updated_at = NOW()
        WHERE tenant_id = $2 AND farmer_id = $3 AND date = $4 AND status = 'EXPECTED'
      `;
      const updateParams: unknown[] = [`Operational Closure: ${reason}`, tenantId, farmerId, date];

      const updatedDeliveries = await client.query(updateSql, updateParams);

      // Record closure in activity_events
      await client.query(
        `INSERT INTO activity_events (id, tenant_id, actor_id, actor_role, action, description, metadata, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'OPERATIONAL_CLOSURE', $4, $5, NOW())`,
        [
          tenantId,
          auth.user.userId,
          auth.user.role,
          `Operational closure recorded for date ${date}: ${reason}`,
          JSON.stringify({ date, reason, shift, affectedDeliveries: updatedDeliveries.rowCount }),
        ]
      );

      return updatedDeliveries.rowCount || 0;
    });

    return NextResponse.json({
      success: true,
      message: `Operational closure applied for ${date}. ${affectedCount} deliveries marked as SKIPPED.`,
      affectedDeliveries: affectedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to apply operational closure';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
