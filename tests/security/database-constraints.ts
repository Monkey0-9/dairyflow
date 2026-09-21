import { describe, it, expect } from 'vitest';
import { LIVE_DB_TESTS_ENABLED } from '../setup';
import { query } from '@/lib/db';

describe.skipIf(!LIVE_DB_TESTS_ENABLED)('Move 3: Database as the Final Security Boundary', () => {
  const runId = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;

  it('proves PostgreSQL rejects negative daily quantity on customer_profiles via CHECK constraint', async () => {
    let errorCaught: unknown = null;
    try {
      await query(
        `INSERT INTO customer_profiles (id, tenant_id, user_id, farmer_id, delivery_address, daily_quantity, qr_token)
         VALUES ($1, 'tenant_greenvalley', 'u_test_chk', 'F001', 'Test Address', -5.0, $2)`,
        [`cust_chk_${runId}`, `qr_chk_${runId}`]
      );
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    // PostgreSQL error code 23514 is check_violation
    const pgErr = errorCaught as { code?: string; message?: string };
    expect(pgErr.code === '23514' || pgErr.message?.includes('check_customer_qty') || pgErr.message?.includes('violates check constraint')).toBe(true);
  });

  it('proves PostgreSQL rejects negative price on products via CHECK constraint', async () => {
    let errorCaught: unknown = null;
    try {
      await query(
        `INSERT INTO products (id, tenant_id, name, code, price_per_unit)
         VALUES ($1, 'tenant_greenvalley', 'Illegal Negative Milk', $2, -50.00)`,
        [`prod_neg_${runId}`, `NEG_CODE_${runId}`]
      );
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    const pgErr = errorCaught as { code?: string; message?: string };
    expect(pgErr.code === '23514' || pgErr.message?.includes('check_product_price') || pgErr.message?.includes('violates check constraint')).toBe(true);
  });

  it('proves PostgreSQL rejects negative payment amount via CHECK constraint', async () => {
    let errorCaught: unknown = null;
    try {
      await query(
        `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, transaction_ref)
         VALUES ($1, 'tenant_greenvalley', 'inv_mock', 'cust_mock', 'F001', -100.00, $2)`,
        [`pay_neg_${runId}`, `TXN_NEG_${runId}`]
      );
    } catch (err) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    const pgErr = errorCaught as { code?: string; message?: string };
    expect(pgErr.code === '23514' || pgErr.message?.includes('check_payment_amount') || pgErr.message?.includes('violates check constraint')).toBe(true);
  });
});
