import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query, transaction } from '@/lib/db';
import { isTestMode } from '@/lib/db-scope';
import { getStore } from '@/lib/store';

interface ProdInput {
  cowMilkProduced: number;
  buffaloMilkProduced: number;
  a2MilkProduced: number;
  wasteOrSpillage: number;
  personalConsumption: number;
  remainingStock: number;
}

async function deliveredByProduct(farmerId: string, tenantId: string, date: string): Promise<{ total: number; byCode: Record<string, number> }> {
  const res = await query(
    `SELECT p.code as code, COALESCE(SUM(d.delivered_quantity), 0)::float as qty
     FROM delivery_records d
     JOIN products p ON p.id = d.product_id
     WHERE d.tenant_id = $1 AND d.farmer_id = $2 AND d.date = $3
     GROUP BY p.code`,
    [tenantId, farmerId, date]
  );
  const byCode: Record<string, number> = {};
  let total = 0;
  for (const r of res.rows as { code: string; qty: number }[]) {
    byCode[r.code] = r.qty;
    total += r.qty;
  }
  return { total, byCode };
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const tenantId = auth.user.tenantId;

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    let farmerId = searchParams.get('farmerId') || auth.user.farmerId;

    if (!farmerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmerId)) {
      const fp = await query(`SELECT id FROM farmer_profiles WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
      if (fp.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No farmer profile found for this tenant.' }, { status: 400 });
      }
      farmerId = fp.rows[0].id as string;
    }

    const closing = await query(
      `SELECT status, total_production::float as "totalProduction",
              total_delivered::float as "totalDelivered",
              total_waste::float as "totalWaste",
              total_personal::float as "totalPersonal",
              closing_balance::float as "closingBalance",
              variance::float as variance, locked_by as "lockedBy", locked_at as "lockedAt"
       FROM day_closings WHERE tenant_id = $1 AND farmer_id = $2 AND date = $3`,
      [tenantId, farmerId, date]
    );

    const inv = await query(
      `SELECT product_code as "productCode",
              production_quantity::float as "productionQuantity",
              delivered_quantity::float as "deliveredQuantity",
              waste_quantity::float as "wasteQuantity",
              personal_quantity::float as "personalQuantity",
              closing_stock::float as "closingStock"
       FROM inventory_records WHERE tenant_id = $1 AND farmer_id = $2 AND date = $3`,
      [tenantId, farmerId, date]
    );

    const live = await deliveredByProduct(farmerId, tenantId, date);
    const rows = inv.rows as Record<string, number | string>[];
    const prod = (code: string, field: string): number => {
      const r = rows.find((x) => x.productCode === code);
      return Number(r?.[field] ?? 0);
    };

    const cow = prod('COW', 'productionQuantity');
    const buffalo = prod('BUFFALO', 'productionQuantity');
    const a2 = prod('A2', 'productionQuantity');
    const waste = rows.reduce((s, r) => s + Number(r.wasteQuantity ?? 0), 0);
    const personal = rows.reduce((s, r) => s + Number(r.personalQuantity ?? 0), 0);
    const remaining = rows.reduce((s, r) => s + Number(r.closingStock ?? 0), 0);
    const c = closing.rows[0] as Record<string, number | string> | undefined;
    const totalProduced = cow + buffalo + a2;
    const totalDelivered = live.total;
    const discrepancy = parseFloat((totalProduced - (totalDelivered + remaining + waste + personal)).toFixed(1));

    if (closing.rows.length === 0 && isTestMode()) {
      const store = getStore();
      const rec = store.inventoryReconciliations.get(date);
      if (rec) {
        return NextResponse.json({
          success: true,
          reconciliation: rec,
          dayLockStatus: store.dayLockStatusMap.get(date) || 'OPEN',
        });
      }
    }

    return NextResponse.json({
      success: true,
      source: 'db',
      reconciliation: {
        date,
        tenantId,
        cowMilkProduced: cow,
        buffaloMilkProduced: buffalo,
        a2MilkProduced: a2,
        totalProduced,
        totalDelivered: parseFloat(totalDelivered.toFixed(1)),
        remainingStock: remaining,
        wasteOrSpillage: waste,
        personalConsumption: personal,
        discrepancy,
        closedAt: c ? String(c.lockedAt ?? '') : '',
        closedBy: c ? String(c.lockedBy ?? '') : '',
        status: c ? String(c.status) : (closing.rows.length > 0 ? 'BALANCED' : 'OPEN'),
      },
      dayLockStatus: c ? String(c.status) : 'OPEN',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load inventory data';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'MANAGER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  const tenantId = auth.user.tenantId;
  const actorName = auth.user.name || auth.user.email || 'Farmer Admin';

  try {
    const body = await req.json();
    const {
      date,
      cowMilkProduced,
      buffaloMilkProduced,
      a2MilkProduced,
      wasteOrSpillage,
      personalConsumption,
      remainingStock,
    } = body;

    if (!date) {
      return NextResponse.json({ success: false, error: 'date is required' }, { status: 400 });
    }

    let farmerId = auth.user.farmerId;
    if (!farmerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmerId)) {
      const fp = await query(`SELECT id FROM farmer_profiles WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`, [tenantId]);
      if (fp.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No farmer profile found for this tenant.' }, { status: 400 });
      }
      farmerId = fp.rows[0].id as string;
    }

    const input: ProdInput = {
      cowMilkProduced: parseFloat(cowMilkProduced || 0),
      buffaloMilkProduced: parseFloat(buffaloMilkProduced || 0),
      a2MilkProduced: parseFloat(a2MilkProduced || 0),
      wasteOrSpillage: parseFloat(wasteOrSpillage || 0),
      personalConsumption: parseFloat(personalConsumption || 0),
      remainingStock: parseFloat(remainingStock || 0),
    };

    const existing = await query(`SELECT status FROM day_closings WHERE tenant_id = $1 AND farmer_id = $2 AND date = $3`, [tenantId, farmerId, date]);
    if (existing.rows.length > 0 && existing.rows[0].status === 'FINALIZED') {
      return NextResponse.json(
        { success: false, error: `Day ${date} has already been closed and locked.` },
        { status: 409 }
      );
    }

    const live = await deliveredByProduct(farmerId, tenantId, date);
    const totalProduced = input.cowMilkProduced + input.buffaloMilkProduced + input.a2MilkProduced;
    const accounted = live.total + input.remainingStock + input.wasteOrSpillage + input.personalConsumption;
    const variance = parseFloat((totalProduced - accounted).toFixed(1));

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO day_closings (id, tenant_id, farmer_id, date, status, total_production, total_delivered, total_waste, total_personal, closing_balance, variance, locked_by)
         VALUES (gen_random_uuid(), $1, $2, $3, 'FINALIZED', $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (farmer_id, date) DO UPDATE SET
           status = 'FINALIZED', total_production = EXCLUDED.total_production,
           total_delivered = EXCLUDED.total_delivered, total_waste = EXCLUDED.total_waste,
           total_personal = EXCLUDED.total_personal, closing_balance = EXCLUDED.closing_balance,
           variance = EXCLUDED.variance, locked_by = EXCLUDED.locked_by, locked_at = NOW()`,
        [tenantId, farmerId, date, totalProduced, live.total, input.wasteOrSpillage, input.personalConsumption, input.remainingStock, variance, actorName]
      );

      const splits: [string, number][] = [
        ['COW', input.cowMilkProduced],
        ['BUFFALO', input.buffaloMilkProduced],
        ['A2', input.a2MilkProduced],
      ];
      for (const [code, produced] of splits) {
        await client.query(
          `INSERT INTO inventory_records (id, tenant_id, farmer_id, date, product_code, production_quantity, delivered_quantity, waste_quantity, personal_quantity, opening_stock, closing_stock, difference)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, 0, 0, 0, 0)
           ON CONFLICT (farmer_id, date, product_code) DO UPDATE SET
             production_quantity = EXCLUDED.production_quantity,
             delivered_quantity = EXCLUDED.delivered_quantity`,
          [tenantId, farmerId, date, code, produced, live.byCode[code] ?? 0]
        );
      }
    });

    if (isTestMode()) {
      try {
        const store = getStore();
        store.closeDay(date, input, { userId: auth.user.userId, name: actorName, role: 'FARMER' });
      } catch { /* test store mirror */ }
    }

    return NextResponse.json({
      success: true,
      source: 'db',
      reconciliation: {
        date,
        tenantId,
        ...input,
        totalProduced,
        totalDelivered: parseFloat(live.total.toFixed(1)),
        discrepancy: variance,
        closedBy: actorName,
        status: Math.abs(variance) < 0.1 ? 'BALANCED' : 'DISCREPANCY',
      },
      dayLockStatus: 'FINALIZED',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to close day';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
