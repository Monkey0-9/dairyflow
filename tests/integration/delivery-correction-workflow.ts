import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LIVE_DB_TESTS_ENABLED } from '../setup';
import { query, getPool } from '@/lib/db';
import { updateDeliveryStatus } from '@/lib/services/delivery.service';
import { applyDeliveryCorrection, getDeliveryCorrections } from '@/lib/services/delivery-correction.service';

describe.skipIf(!LIVE_DB_TESTS_ENABLED)('Integration: FR-DEL-009 Post-Day-Close Delivery Correction Workflow', () => {
  const testTenantId = 't_test_corr_001';
  const testFarmerUserId = 'u_farmer_corr_001';
  const testFarmerProfileId = 'f_corr_001';
  const testCustomerUserId = 'u_cust_corr_001';
  const testCustomerProfileId = 'c_corr_001';
  const testDeliveryId = 'del_corr_test_001';
  const testDate = '2026-09-15';

  beforeAll(async () => {
    // 1. Seed tenant
    await query(
      `INSERT INTO tenants (id, name, slug, created_at)
       VALUES ($1, 'Correction Test Dairy', 'corr-test-dairy', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testTenantId]
    );

    // 2. Seed farmer user & profile
    await query(
      `INSERT INTO users (id, tenant_id, email, password_hash, password_salt, role, name, phone, created_at)
       VALUES ($1, $2, 'farmer_corr@dairy.com', 'hash_dummy', 'salt_dummy', 'FARMER', 'Farmer Ramesh', '9876543210', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testFarmerUserId, testTenantId]
    );
    await query(
      `INSERT INTO farmer_profiles (id, user_id, tenant_id, business_name, upi_id, address, created_at)
       VALUES ($1, $2, $3, 'Ramesh Dairy', 'ramesh@upi', 'Farm Estate 1', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testFarmerProfileId, testFarmerUserId, testTenantId]
    );

    // 3. Seed customer user & profile
    await query(
      `INSERT INTO users (id, tenant_id, email, password_hash, password_salt, role, name, phone, created_at)
       VALUES ($1, $2, 'cust_corr@dairy.com', 'hash_dummy', 'salt_dummy', 'CUSTOMER', 'Customer Priya', '9876543211', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testCustomerUserId, testTenantId]
    );
    await query(
      `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, qr_token, status, is_active, created_at)
       VALUES ($1, $2, $3, $4, 'Flat 101, Test Tower', 'qr_token_test_99', 'ACTIVE', true, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testCustomerProfileId, testCustomerUserId, testTenantId, testFarmerProfileId]
    );

    const testProductId = 'prod_corr_001';
    await query(
      `INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, is_active, created_at)
       VALUES ($1, $2, 'Standard Cow Milk', 'COW', 'L', 60.0, true, NOW())
       ON CONFLICT (tenant_id, code) DO NOTHING`,
      [testProductId, testTenantId]
    );

    // 4. Seed initial delivery record
    await query(
      `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, status, scheduled_quantity, delivered_quantity, price_per_unit, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'DELIVERED', 2.0, 2.0, 60.0, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [testDeliveryId, testTenantId, testCustomerProfileId, testFarmerProfileId, testProductId, testDate]
    );

    // 5. Finalize day closing on that date
    await query(
      `INSERT INTO day_closings (id, tenant_id, farmer_id, date, status, total_production, total_delivered, closing_balance, variance, locked_by, locked_at)
       VALUES ($1, $2, $3, $4, 'FINALIZED', 10.0, 2.0, 8.0, 0.0, $5, NOW())
       ON CONFLICT (farmer_id, date) DO UPDATE SET status = 'FINALIZED', total_delivered = 2.0, variance = 0.0`,
      [`close_${testFarmerProfileId}_${testDate}`, testTenantId, testFarmerProfileId, testDate, testFarmerUserId]
    );
  });

  afterAll(async () => {
    await query(`DELETE FROM delivery_corrections WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM audit_blocks WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM day_closings WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM delivery_records WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM customer_profiles WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM farmer_profiles WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM products WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM users WHERE tenant_id = $1`, [testTenantId]);
    await query(`DELETE FROM tenants WHERE id = $1`, [testTenantId]);
  });

  it('verifies standard updateDeliveryStatus is blocked when day closing is FINALIZED', async () => {
    const res = await updateDeliveryStatus({
      deliveryId: testDeliveryId,
      customerId: testCustomerProfileId,
      farmerId: testFarmerProfileId,
      date: testDate,
      status: 'PARTIAL',
      deliveredQuantity: 1.0,
      notes: 'Unverified post-close edit attempt',
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/finalized and locked/i);
  });

  it('rejects post-close correction submission from unauthorized roles (CUSTOMER)', async () => {
    const res = await applyDeliveryCorrection({
      deliveryRecordId: testDeliveryId,
      correctedQuantity: 3.0,
      reason: 'Customer attempting self-correction',
      authorizedBy: testCustomerUserId,
      authorizedRole: 'CUSTOMER',
      tenantId: testTenantId,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });

  it('executes authorized correction workflow, adjusts ledger, updates variance, and mints audit block', async () => {
    const res = await applyDeliveryCorrection({
      deliveryRecordId: testDeliveryId,
      correctedQuantity: 3.5,
      correctedStatus: 'DELIVERED',
      reason: 'Audited delivery verification confirmed 1.5L extra delivered on evening run',
      authorizedBy: testFarmerUserId,
      authorizedRole: 'FARMER',
      tenantId: testTenantId,
    });

    expect(res.success).toBe(true);
    expect(res.correction).toBeDefined();
    expect(res.correction?.originalQuantity).toBe(2.0);
    expect(res.correction?.correctedQuantity).toBe(3.5);
    expect(res.correction?.status).toBe('APPLIED');
    expect(res.auditBlock).toBeDefined();
    expect(res.auditBlock?.action).toBe('DELIVERY_CORRECTION');

    // Verify delivery record was updated
    const delCheck = await query(`SELECT delivered_quantity::float, notes FROM delivery_records WHERE id = $1`, [testDeliveryId]);
    expect(delCheck.rows[0].delivered_quantity).toBe(3.5);
    expect(delCheck.rows[0].notes).toContain('Corrected: 2L -> 3.5L');

    // Verify day closing totals and variance were reconciled
    const closeCheck = await query(`SELECT total_delivered::float, variance::float FROM day_closings WHERE farmer_id = $1 AND date = $2`, [testFarmerProfileId, testDate]);
    expect(closeCheck.rows[0].total_delivered).toBe(3.5);
    expect(closeCheck.rows[0].variance).toBe(-1.5);

    // Verify cryptographic audit block in database
    const blockCheck = await query(`SELECT * FROM audit_blocks WHERE entity_id = $1 AND action = 'DELIVERY_CORRECTION'`, [testDeliveryId]);
    expect(blockCheck.rows.length).toBeGreaterThan(0);
    expect(blockCheck.rows[0].current_hash).toHaveLength(64);

    // Verify history retrieval API
    const history = await getDeliveryCorrections({ tenantId: testTenantId, date: testDate });
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].correctedQuantity).toBe(3.5);
    expect(history[0].reason).toContain('Audited delivery verification');
  });
});
