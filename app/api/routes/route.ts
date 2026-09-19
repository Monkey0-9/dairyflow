import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query, transaction } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const tenantId = auth.user.tenantId;
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
      WHERE r.tenant_id = $1 AND r.farmer_id = $2
    `;
    const params: unknown[] = [tenantId, farmerId];

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
    const tenantId = auth.user.tenantId;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: 'name and code are required.' }, { status: 400 });
    }

    // Resolve the farmer profile from the database: seed ids (F001) never
    // exist in PostgreSQL and would violate the routes FK.
    let farmerId = auth.user.farmerId;
    if (!farmerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmerId)) {
      const fp = await query(`SELECT id FROM farmer_profiles WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
      if (fp.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No farmer profile found for this dairy.' }, { status: 400 });
      }
      farmerId = fp.rows[0].id as string;
    }

    const route = await transaction(async (client) => {
      const routeRes = await client.query(
        `INSERT INTO routes (id, tenant_id, farmer_id, name, code, shift, agent_user_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, name, code, shift, agent_user_id as "agentUserId"`,
        [tenantId, farmerId, name, code, shift || 'MORNING', agentUserId || null]
      );

      const createdRoute = routeRes.rows[0];

      if (Array.isArray(stops) && stops.length > 0) {
        for (const stop of stops) {
          await client.query(
            `INSERT INTO route_stops (id, route_id, customer_id, stop_sequence)
             VALUES (gen_random_uuid(), $1, $2, $3)`,
            [createdRoute.id, stop.customerId, stop.stopSequence || 1]
          );
        }
      }

      return createdRoute;
    });

    return NextResponse.json({ success: true, route });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create route';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
