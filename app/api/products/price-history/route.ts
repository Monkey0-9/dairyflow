import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { createProductPriceHistory } from '@/lib/services/subscription-pricing.service';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');

  try {
    let sql = `
      SELECT h.id, h.product_id as "productId", h.price_per_unit::float as "pricePerUnit",
             h.effective_from as "effectiveFrom", h.effective_to as "effectiveTo",
             h.created_at as "createdAt", p.name as "productName"
      FROM product_price_histories h
      JOIN products p ON h.product_id = p.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (productId) {
      params.push(productId);
      sql += ` AND h.product_id = $${params.length}`;
    }
    sql += ` ORDER BY h.effective_from DESC`;

    const res = await query(sql, params);
    return NextResponse.json({ success: true, priceHistories: res.rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch price histories';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { productId, pricePerUnit, effectiveFrom, effectiveTo } = await req.json();

    if (!productId || typeof pricePerUnit !== 'number' || !effectiveFrom) {
      return NextResponse.json(
        { success: false, error: 'productId, pricePerUnit, and effectiveFrom are required.' },
        { status: 400 }
      );
    }

    const priceRecord = await createProductPriceHistory({
      productId,
      pricePerUnit: parseFloat(String(pricePerUnit)),
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      createdById: auth.user.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Product price history created successfully.',
      priceRecord,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create price history';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
