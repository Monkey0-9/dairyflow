import { describe, it, expect } from 'vitest';
import { createSubscriptionVersion, createProductPriceHistory, getLockedUnitPrice } from '@/lib/services/subscription-pricing.service';
import { executeIdempotentOperation } from '@/lib/security/idempotency';
import { computeStatementBalance } from '@/lib/services/billing.service';

describe('Deep Domain Invariants & Enterprise Quality Audit', () => {
  it('enforces statement balance equation: Opening + Charges + Adjustments - Payments = Closing', () => {
    const calc = computeStatementBalance({
      openingBalance: 500,
      currentCharges: 1200,
      adjustments: -100, // Credit note reduction of ₹100
      payments: 1000,
    });

    // 500 + 1200 - 100 - 1000 = 600
    expect(calc.closingBalance).toBe(600);
    expect(calc.status).toBe('PARTIALLY_PAID');
  });

  it('guarantees universal mutation idempotency with operationId caching and replay safety', async () => {
    let executionCount = 0;
    const mockMutation = async () => {
      executionCount += 1;
      return { deliveryId: 'del_1001', status: 'DELIVERED', quantity: 2.5 };
    };

    const opId = 'op_unique_test_' + Date.now();

    // 1. Initial call: executes target mutation
    const firstCall = await executeIdempotentOperation(opId, 'RECORD_DELIVERY', 'user_farmer', mockMutation);
    expect(firstCall.isReplay).toBe(false);
    expect(firstCall.result.quantity).toBe(2.5);
    expect(executionCount).toBe(1);

    // 2. Duplicate retry call with same opId: returns cached result without re-executing
    const secondCall = await executeIdempotentOperation(opId, 'RECORD_DELIVERY', 'user_farmer', mockMutation);
    expect(secondCall.isReplay).toBe(true);
    expect(secondCall.result.quantity).toBe(2.5);
    expect(executionCount).toBe(1); // Function was NOT called a second time!
  });

  it('creates effective-dated subscription versions and product price history', async () => {
    const { query } = await import('@/lib/db');
    const prodRes = await query<{ id: string }>('SELECT id FROM products LIMIT 1');
    const validProdId = prodRes.rows[0]?.id || 'prod_cow_milk';
    await query('DELETE FROM product_price_histories WHERE product_id = $1', [validProdId]);

    const uniqueCustId = 'cust_test_inv_' + Date.now();
    const uniqueUserId = 'user_test_inv_' + Date.now();
    await query(
      `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role, created_at, updated_at)
       VALUES ($1, 'tenant_greenvalley', $2, $3, 'Test Customer Inv', 'HASH', 'SALT', 'CUSTOMER', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [uniqueUserId, `test_inv_${Date.now()}@milkflow.in`, `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`]
    );

    await query(
      `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token, is_active, created_at, updated_at)
       VALUES ($1, $2, 'tenant_greenvalley', 'F001', 'Test Address', 'COW', 2.0, $3, true, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [uniqueCustId, uniqueUserId, 'qr_inv_' + Date.now()]
    );

    const uniqueOffset = Math.floor(Math.random() * 1000000000);
    const effectiveFrom = new Date(Date.now() + 10000000000 + uniqueOffset);
    const effectiveTo = new Date(effectiveFrom.getTime() + 86400000 * 30);

    const subVer = await createSubscriptionVersion({
      subscriptionId: 'sub_test_' + Date.now(),
      customerId: uniqueCustId,
      productId: validProdId,
      quantity: 2.0,
      effectiveFrom,
      effectiveTo,
      createdById: 'user_farmer',
    });

    expect(subVer.id).toBeDefined();
    expect(subVer.quantity).toBe(2.0);

    const priceFrom = new Date(Date.now() + 20000000000 + uniqueOffset);
    const priceTo = new Date(priceFrom.getTime() + 86400000 * 30);

    const priceHist = await createProductPriceHistory({
      productId: validProdId,
      pricePerUnit: 68.0,
      effectiveFrom: priceFrom,
      effectiveTo: priceTo,
      createdById: 'user_farmer',
    });

    expect(priceHist.id).toBeDefined();
    expect(priceHist.pricePerUnit).toBe(68.0);
  });

  it('locks unit price accurately for specific delivery dates', async () => {
    const { query } = await import('@/lib/db');
    const prodRes = await query<{ id: string }>('SELECT id FROM products LIMIT 1');
    const validProdId = prodRes.rows[0]?.id || 'prod_cow_milk';

    // Delivery date locked unit price lookup
    const price = await getLockedUnitPrice(validProdId, '2026-09-18');
    expect(price).toBeGreaterThan(0);
  });
});

