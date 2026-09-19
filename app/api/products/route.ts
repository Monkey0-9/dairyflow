import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { createProductPriceHistory } from '@/lib/services/subscription-pricing.service';

export interface ProductCostItem {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  unit: string;
  pricePerUnit: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/products
 * Lists all milk types / products and their configured costs for the tenant.
 */
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const activeOnly = searchParams.get('activeOnly') === 'true';

  try {
    let sql = `
      SELECT id, tenant_id as "tenantId", name, code, unit,
             price_per_unit::float as "pricePerUnit", description,
             is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM products
      WHERE tenant_id = $1
    `;
    const params: unknown[] = [auth.user.tenantId];

    if (code) {
      params.push(code.toUpperCase());
      sql += ` AND UPPER(code) = $${params.length}`;
    }

    if (activeOnly) {
      sql += ` AND is_active = true`;
    }

    sql += ` ORDER BY name ASC`;

    const res = await query<ProductCostItem>(sql, params);
    return NextResponse.json({
      success: true,
      products: res.rows,
      total: res.rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch products';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/products
 * Farmer or Admin creates a new milk product / category (e.g. Cow Milk, Buffalo Milk)
 * with an initial cost or null cost.
 */
export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const { name, code, unit = 'L', pricePerUnit, description } = body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Product name and code are required (e.g. Cow Milk, COW).' },
        { status: 400 }
      );
    }

    const cleanPrice =
      pricePerUnit !== undefined && pricePerUnit !== null && !isNaN(Number(pricePerUnit))
        ? parseFloat(String(pricePerUnit))
        : null;

    if (cleanPrice !== null && cleanPrice < 0) {
      return NextResponse.json(
        { success: false, error: 'Cost/price per unit cannot be negative.' },
        { status: 400 }
      );
    }

    const productId = `prod_${code.toLowerCase()}_${Date.now()}`;

    const res = await query<ProductCostItem>(
      `INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
       RETURNING id, tenant_id as "tenantId", name, code, unit,
                 price_per_unit::float as "pricePerUnit", description,
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [productId, auth.user.tenantId, name, code.toUpperCase(), unit, cleanPrice, description || null]
    );

    const product = res.rows[0];

    // If initial cost is provided, record initial price history
    if (cleanPrice !== null) {
      await createProductPriceHistory({
        productId: product.id,
        pricePerUnit: cleanPrice,
        effectiveFrom: new Date(),
        createdById: auth.user.userId,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `Product ${product.name} created successfully with cost ${cleanPrice !== null ? `₹${cleanPrice}/${unit}` : 'NULL (Unpriced)'}.`,
      product,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create product';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/products
 * Farmer or Admin updates the cost/price of Cow Milk, Buffalo Milk, etc.
 * Can set a new numerical cost, or set to null.
 */
export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const { productId, code, pricePerUnit, name, description, isActive, effectiveFrom } = body;

    if (!productId && !code) {
      return NextResponse.json(
        { success: false, error: 'Either productId or product code is required.' },
        { status: 400 }
      );
    }

    // Lookup product
    let targetSql = `SELECT id, name, code, price_per_unit::float as "pricePerUnit" FROM products WHERE tenant_id = $1`;
    const targetParams: unknown[] = [auth.user.tenantId];
    if (productId) {
      targetParams.push(productId);
      targetSql += ` AND id = $2`;
    } else {
      targetParams.push(code.toUpperCase());
      targetSql += ` AND UPPER(code) = $2`;
    }

    const prodRes = await query<{ id: string; name: string; code: string; pricePerUnit: number | null }>(
      targetSql,
      targetParams
    );

    const product = prodRes.rows[0];
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found.' }, { status: 404 });
    }

    // Determine new price
    let newPrice: number | null = product.pricePerUnit;
    let priceChanged = false;

    if (pricePerUnit === null) {
      newPrice = null;
      priceChanged = true;
    } else if (pricePerUnit !== undefined) {
      const parsed = parseFloat(String(pricePerUnit));
      if (isNaN(parsed) || parsed < 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid cost. Price must be a non-negative number or null.' },
          { status: 400 }
        );
      }
      newPrice = parsed;
      priceChanged = true;
    }

    const updatedRes = await query<ProductCostItem>(
      `UPDATE products
       SET price_per_unit = $1,
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6
       RETURNING id, tenant_id as "tenantId", name, code, unit,
                 price_per_unit::float as "pricePerUnit", description,
                 is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"`,
      [newPrice, name || null, description || null, isActive !== undefined ? isActive : null, product.id, auth.user.tenantId]
    );

    const updatedProduct = updatedRes.rows[0];

    // If numerical price changed, log in product_price_histories
    if (priceChanged && newPrice !== null) {
      const effFrom = effectiveFrom ? new Date(effectiveFrom) : new Date();
      await createProductPriceHistory({
        productId: product.id,
        pricePerUnit: newPrice,
        effectiveFrom: effFrom,
        createdById: auth.user.userId,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      message: `Cost for ${updatedProduct.name} successfully updated to ${newPrice !== null ? `₹${newPrice}` : 'NULL'}.`,
      product: updatedProduct,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update product cost';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
