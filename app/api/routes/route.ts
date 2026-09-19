import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const farmerId = searchParams.get('farmerId') || auth.user.farmerId;
  const shift = searchParams.get('shift');

  try {
    let sql = `
      SELECT r.id, r.name, r.code, r.shift, r.agent_user_id as "agentUserId",
             r.tenant_id as "tenantId", r.farmer_id as "farmerId",
             COALESCE(
               json_agg(
                 json_build_object(
                   'stopId', s.id,
                   'customerId', s.customer_id,
                   'stopSequence', s.stop_sequence,
                   'customerName', u.name,
                   'deliveryAddress', c.delivery_address,
                   'dailyQuantity', c.daily_quantity,
                   'milkType', c.milk_type
                 ) ORDER BY s.stop_sequence ASC
               ) FILTER (WHERE s.id IS NOT NULL),
               '[]'
             ) as stops
      FROM routes r
      LEFT JOIN route_stops s ON r.id = s.route_id
      LEFT JOIN customer_profiles c ON s.customer_id = c.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE r.farmer_id = $1
    `;
    const params: unknown[] = [farmerId];

    if (shift) {
      params.push(shift);
      sql += ` AND r.shift = $${params.length}`;
    }

    sql += ` GROUP BY r.id ORDER BY r.name ASC`;

    const res = await query(sql, params);
    return NextResponse.json({ success: true, routes: res.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch routes';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'MANAGER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { name, code, shift, agentUserId, stops } = await req.json();

    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'name and code are required.' }, { status: 400 });
    }

    const tenantId = auth.user.tenantId;
    const farmerId = auth.user.farmerId || 'F001';

    await query('BEGIN');
    const routeRes = await query(
      `INSERT INTO routes (id, tenant_id, farmer_id, name, code, shift, agent_user_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, name, code, shift, agent_user_id as "agentUserId"`,
      [tenantId, farmerId, name, code, shift || 'MORNING', agentUserId || null]
    );

    const route = routeRes.rows[0];

    if (Array.isArray(stops) && stops.length > 0) {
      for (const stop of stops) {
        await query(
          `INSERT INTO route_stops (id, route_id, customer_id, stop_sequence)
           VALUES (gen_random_uuid(), $1, $2, $3)`,
          [route.id, stop.customerId, stop.stopSequence || 1]
        );
      }
    }

    await query('COMMIT');
    return NextResponse.json({ success: true, route });
  } catch (err: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : 'Failed to create route';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
