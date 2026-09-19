import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { createSubscriptionVersion } from '@/lib/services/subscription-pricing.service';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');

  try {
    let sql = `
      SELECT v.id, v.subscription_id as "subscriptionId", v.customer_id as "customerId",
             v.product_id as "productId", v.quantity::float as "quantity",
             v.frequency, v.shift, v.effective_from as "effectiveFrom",
             v.effective_to as "effectiveTo", v.created_at as "createdAt",
             p.name as "productName"
      FROM subscription_versions v
      JOIN products p ON v.product_id = p.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (customerId) {
      params.push(customerId);
      sql += ` AND v.customer_id = $${params.length}`;
    }
    sql += ` ORDER BY v.effective_from DESC`;

    const res = await query(sql, params);
    return NextResponse.json({ success: true, subscriptionVersions: res.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch subscription versions';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { subscriptionId, customerId, productId, quantity, frequency, shift, effectiveFrom, effectiveTo } = await req.json();

    if (!subscriptionId || !customerId || !productId || typeof quantity !== 'number' || !effectiveFrom) {
      return NextResponse.json(
        { success: false, error: 'subscriptionId, customerId, productId, quantity, and effectiveFrom are required.' },
        { status: 400 }
      );
    }

    const versionRecord = await createSubscriptionVersion({
      subscriptionId,
      customerId,
      productId,
      quantity: parseFloat(String(quantity)),
      frequency: frequency || 'DAILY',
      shift: shift || 'MORNING',
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      createdById: auth.user.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription version created successfully.',
      versionRecord,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create subscription version';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
