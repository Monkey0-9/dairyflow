import { query } from '../db';

export interface DbSubscriptionVersion {
  id: string;
  subscriptionId: string;
  customerId: string;
  productId: string;
  quantity: number;
  frequency: string;
  shift: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdById: string;
  createdAt: string;
}

export interface DbProductPriceHistory {
  id: string;
  productId: string;
  pricePerUnit: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdById: string;
  createdAt: string;
}

/**
 * Creates a new effective-dated SubscriptionVersion, enforcing that date ranges do not overlap.
 */
export async function createSubscriptionVersion(params: {
  subscriptionId: string;
  customerId: string;
  productId: string;
  quantity: number;
  frequency?: string;
  shift?: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  createdById: string;
}): Promise<DbSubscriptionVersion> {
  const effectiveFromStr = params.effectiveFrom.toISOString();
  const effectiveToStr = params.effectiveTo ? params.effectiveTo.toISOString() : null;

  // 1. Auto-cap any prior open-ended version to avoid unintended future overlap
  await query(
    `UPDATE subscription_versions
     SET effective_to = $2
     WHERE customer_id = $1 AND effective_to IS NULL AND effective_from < $2`,
    [params.customerId, effectiveFromStr]
  );

  // 2. Check for overlapping versions for this customer (Range overlap: StartA < EndB AND EndA > StartB)
  const overlapRes = await query(
    `SELECT id FROM subscription_versions
     WHERE customer_id = $1
       AND effective_from < COALESCE($3::timestamp, '9999-12-31'::timestamp)
       AND COALESCE(effective_to, '9999-12-31'::timestamp) > $2::timestamp`,
    [params.customerId, effectiveFromStr, effectiveToStr]
  );

  if (overlapRes.rows.length > 0) {
    throw new Error('Subscription version overlap error: Effective date range conflicts with an existing subscription version.');
  }

  const res = await query<DbSubscriptionVersion>(
    `INSERT INTO subscription_versions (
       id, subscription_id, customer_id, product_id, quantity, frequency, shift,
       effective_from, effective_to, created_by_id, created_at
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING id, subscription_id as "subscriptionId", customer_id as "customerId",
               product_id as "productId", quantity::float as quantity, frequency, shift,
               effective_from as "effectiveFrom", effective_to as "effectiveTo",
               created_by_id as "createdById", created_at as "createdAt"`,
    [
      params.subscriptionId,
      params.customerId,
      params.productId,
      params.quantity,
      params.frequency || 'DAILY',
      params.shift || 'MORNING',
      effectiveFromStr,
      effectiveToStr,
      params.createdById,
    ]
  );

  return res.rows[0];
}

/**
 * Creates an effective-dated ProductPriceHistory record, enforcing non-overlapping periods.
 */
export async function createProductPriceHistory(params: {
  productId: string;
  pricePerUnit: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  createdById: string;
}): Promise<DbProductPriceHistory> {
  const effectiveFromStr = params.effectiveFrom.toISOString();
  const effectiveToStr = params.effectiveTo ? params.effectiveTo.toISOString() : null;

  // 1. Auto-cap prior open-ended price record
  await query(
    `UPDATE product_price_histories
     SET effective_to = $2
     WHERE product_id = $1 AND effective_to IS NULL AND effective_from < $2`,
    [params.productId, effectiveFromStr]
  );

  // 2. Check for overlapping price periods
  const overlapRes = await query(
    `SELECT id FROM product_price_histories
     WHERE product_id = $1
       AND effective_from < COALESCE($3::timestamp, '9999-12-31'::timestamp)
       AND COALESCE(effective_to, '9999-12-31'::timestamp) > $2::timestamp`,
    [params.productId, effectiveFromStr, effectiveToStr]
  );

  if (overlapRes.rows.length > 0) {
    throw new Error('Product pricing overlap error: Effective date range conflicts with an existing price period.');
  }

  const res = await query<DbProductPriceHistory>(
    `INSERT INTO product_price_histories (
       id, product_id, price_per_unit, effective_from, effective_to, created_by_id, created_at
     )
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
     RETURNING id, product_id as "productId", price_per_unit::float as "pricePerUnit",
               effective_from as "effectiveFrom", effective_to as "effectiveTo",
               created_by_id as "createdById", created_at as "createdAt"`,
    [
      params.productId,
      params.pricePerUnit,
      effectiveFromStr,
      effectiveToStr,
      params.createdById,
    ]
  );

  return res.rows[0];
}

/**
 * Price Locking Invariant: Retrieves unit price in effect for a product on a specific date.
 */
export async function getLockedUnitPrice(productId: string, date: string | Date): Promise<number> {
  const targetDateStr = typeof date === 'string' ? new Date(date).toISOString() : date.toISOString();

  // Try fetching from ProductPriceHistory first
  const historyRes = await query<{ pricePerUnit: number }>(
    `SELECT price_per_unit::float as "pricePerUnit"
     FROM product_price_histories
     WHERE product_id = $1
       AND effective_from <= $2
       AND (effective_to IS NULL OR effective_to >= $2)
     ORDER BY effective_from DESC
     LIMIT 1`,
    [productId, targetDateStr]
  );

  if (historyRes.rows.length > 0 && historyRes.rows[0].pricePerUnit) {
    return historyRes.rows[0].pricePerUnit;
  }

  // Fallback to base product price
  const prodRes = await query<{ pricePerUnit: number }>(
    `SELECT price_per_unit::float as "pricePerUnit" FROM products WHERE id = $1`,
    [productId]
  );

  return prodRes.rows[0]?.pricePerUnit || 60.0;
}
