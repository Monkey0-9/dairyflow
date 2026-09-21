import { describe, it, expect } from 'vitest';
import { LIVE_DB_TESTS_ENABLED } from '../setup';
import { query, transaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { recalculateInvoice } from '@/lib/services/billing.service';
import { updateDeliveryStatus } from '@/lib/services/delivery.service';
import { appendAuditLog, verifyAuditChain } from '@/lib/services/audit.service';

describe.skipIf(!LIVE_DB_TESTS_ENABLED)('Stage 2: Real PostgreSQL Database Integration Testing', () => {
  // Use a dedicated isolated test tenant so real database runs do not conflict
  const runId = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const testTenantId = `tenant_stage2_${runId}`;
  const testFarmerUserId = `user_f_${runId}`;
  const testFarmerProfileId = `farmer_${runId}`;
  const testCustomerUserId = `user_c_${runId}`;
  const testCustomerProfileId = `cust_${runId}`;
  const testProductId = `prod_cow_${runId}`;
  const targetDate = '2026-09-19';

  it('verifies 100% real database lifecycle on live Neon PostgreSQL', async () => {
    // 1. Create Tenant and Farmer in real PostgreSQL
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO tenants (id, name, slug, is_active) VALUES ($1, $2, $3, true)`,
        [testTenantId, `Stage 2 Dairy ${runId}`, `stage2-${runId}`]
      );

      const { hash, salt } = hashPassword('FarmerSecurePass123!');
      await client.query(
        `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt)
        VALUES ($1, $2, $3, $4, $5, 'FARMER', $6, $7)`,
        [testFarmerUserId, testTenantId, 'Farmer Ramesh', `ramesh_${runId}@dairy.in`, `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, hash, salt]
      );

      await client.query(
        `INSERT INTO farmer_profiles (id, tenant_id, user_id, business_name, upi_id, address)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [testFarmerProfileId, testTenantId, testFarmerUserId, 'Ramesh Organic Farms', 'ramesh@upi', 'Anand Dairy Road']
      );

      await client.query(
        `INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, is_active)
        VALUES ($1, $2, 'A2 Pure Cow Milk', $3, 'Litre', 60.00, true)`,
        [testProductId, testTenantId, `CODE_${runId}`]
      );
    });

    // 2. Real Customer Signup / Profile Creation
    const { hash: custHash, salt: custSalt } = hashPassword('CustomerSecret987!');
    await query(
      `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt)
      VALUES ($1, $2, $3, $4, $5, 'CUSTOMER', $6, $7)`,
      [testCustomerUserId, testTenantId, 'Anita Desai', `anita_${runId}@gmail.com`, `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`, custHash, custSalt]
    );

    await query(
      `INSERT INTO customer_profiles (id, tenant_id, user_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testCustomerProfileId, testTenantId, testCustomerUserId, testFarmerProfileId, 'Flat 401, Galaxy Apts', 'A2', 2.0, `QR_STAGE2_${runId}`]
    );

    // Verify customer persisted in PostgreSQL
    const custCheck = await query(`SELECT * FROM customer_profiles WHERE id = $1`, [testCustomerProfileId]);
    expect(custCheck.rows.length).toBe(1);
    expect(custCheck.rows[0].farmer_id).toBe(testFarmerProfileId);

    // 3. Real Subscription Creation
    const testSubId = `sub_${runId}`;
    await query(
      `INSERT INTO subscriptions (id, tenant_id, customer_id, farmer_id, product_id, quantity, status)
      VALUES ($1, $2, $3, $4, $5, 2.0, 'ACTIVE')`,
      [testSubId, testTenantId, testCustomerProfileId, testFarmerProfileId, testProductId]
    );

    const subCheck = await query(`SELECT * FROM subscriptions WHERE id = $1`, [testSubId]);
    expect(subCheck.rows.length).toBe(1);
    expect(Number(subCheck.rows[0].quantity)).toBe(2.0);

    // 4. Real Delivery Record Creation & Price Locking
    const deliveryId = `del_${runId}_01`;
    await query(
      `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status)
      VALUES ($1, $2, $3, $4, $5, $6, 2.0, 0.0, 60.00, 'EXPECTED')`,
      [deliveryId, testTenantId, testCustomerProfileId, testFarmerProfileId, testProductId, targetDate]
    );

    // 5. Farmer executes Delivery via FSM
    const deliveryResult = await updateDeliveryStatus({
      deliveryId,
      customerId: testCustomerProfileId,
      farmerId: testFarmerProfileId,
      date: targetDate,
      status: 'DELIVERED',
      deliveredQuantity: 2.0,
      notes: 'Delivered 2L fresh milk at door',
      bottlesReturned: 2,
    });
    expect(deliveryResult.success).toBe(true);

    const updatedDel = await query(`SELECT * FROM delivery_records WHERE id = $1`, [deliveryId]);
    expect(updatedDel.rows[0].status).toBe('DELIVERED');
    expect(Number(updatedDel.rows[0].delivered_quantity)).toBe(2.0);
    expect(Number(updatedDel.rows[0].bottles_returned)).toBe(2);

    // 6. Real Pause Request (Vacation)
    const pauseId = `pause_${runId}`;
    await query(
      `INSERT INTO pause_requests (id, tenant_id, customer_id, farmer_id, start_date, end_date, reason, status)
      VALUES ($1, $2, $3, $4, '2026-09-20', '2026-09-22', 'Family trip to Pune', 'PENDING')`,
      [pauseId, testTenantId, testCustomerProfileId, testFarmerProfileId]
    );

    // Farmer approves pause request
    await query(
      `UPDATE pause_requests SET status = 'APPROVED', reviewed_at = NOW(), decision_notes = 'Approved by Ramesh' WHERE id = $1`,
      [pauseId]
    );
    const pauseCheck = await query(`SELECT status FROM pause_requests WHERE id = $1`, [pauseId]);
    expect(pauseCheck.rows[0].status).toBe('APPROVED');

    // 7. Real Extra Milk Request & Delivery
    const extraRequestId = `extra_${runId}`;
    await query(
      `INSERT INTO extra_milk_requests (id, tenant_id, customer_id, farmer_id, date, milk_type, quantity, notes, status)
      VALUES ($1, $2, $3, $4, $5, 'A2', 1.0, 'Guest arrived for tea', 'PENDING')`,
      [extraRequestId, testTenantId, testCustomerProfileId, testFarmerProfileId, targetDate]
    );

    await query(
      `UPDATE extra_milk_requests SET status = 'APPROVED', reviewed_at = NOW() WHERE id = $1`,
      [extraRequestId]
    );
    const extraCheck = await query(`SELECT status FROM extra_milk_requests WHERE id = $1`, [extraRequestId]);
    expect(extraCheck.rows[0].status).toBe('APPROVED');

    // 8. Real Dispute Submission & Resolution
    const disputeId = `disp_${runId}`;
    await query(
      `INSERT INTO disputes (id, tenant_id, customer_id, farmer_id, delivery_id, date, issue_type, claimed_quantity, customer_notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'WRONG_QUANTITY', 0.5, 'Only received 1.5L', 'OPEN')`,
      [disputeId, testTenantId, testCustomerProfileId, testFarmerProfileId, deliveryId, targetDate]
    );

    // Farmer resolves dispute with credit adjustment
    await query(
      `UPDATE disputes SET status = 'RESOLVED', resolution_notes = 'CREDIT_ISSUED', adjusted_amount = 30.00, resolved_at = NOW() WHERE id = $1`,
      [disputeId]
    );

    const disputeCheck = await query(`SELECT status, resolution_notes FROM disputes WHERE id = $1`, [disputeId]);
    expect(disputeCheck.rows[0].status).toBe('RESOLVED');
    expect(disputeCheck.rows[0].resolution_notes).toBe('CREDIT_ISSUED');

    // 9. Real Monthly Invoice Generation & Recalculation
    const invoiceId = `inv_${runId}_09`;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
        VALUES ($1, $2, $3, $4, 9, 2026, 2.0, 120.00, 0.0, 120.00, 'ISSUED', '2026-09-28')`,
        [invoiceId, testTenantId, testCustomerProfileId, testFarmerProfileId]
      );

      await client.query(
        `INSERT INTO invoice_items (id, invoice_id, date, description, quantity, rate, amount)
        VALUES
        ('item_del_${runId}', $1, '2026-09-18', 'Daily Regular Delivery (2L @ ₹60)', 2.0, 60.00, 120.00),
        ('item_extra_${runId}', $1, '2026-09-18', 'Approved Extra Milk (1L @ ₹60)', 1.0, 60.00, 60.00),
        ('item_disp_${runId}', $1, '2026-09-18', 'Dispute Resolution Credit', 1.0, -30.00, -30.00)`,
        [invoiceId]
      );
    });

    // Authoritative recalculation against live PostgreSQL
    const recalcResult = await recalculateInvoice(invoiceId);
    expect(recalcResult).toBeDefined();
    // 120 (regular) + 60 (extra) - 30 (credit) = 150.00
    expect(recalcResult?.totalAmount).toBe(150.00);
    expect(recalcResult?.outstandingAmount).toBe(150.00);
    expect(recalcResult?.status).toBe('UNPAID');

    // 10. Real Payment Processing & Zero Balance Settlement
    const paymentId = `pay_${runId}`;
    const uniqueTxnRef = `UPI_STAGE2_${runId}_TXN`;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, method, status, transaction_ref)
        VALUES ($1, $2, $3, $4, $5, 150.00, 'UPI', 'SUCCESS', $6)`,
        [paymentId, testTenantId, invoiceId, testCustomerProfileId, testFarmerProfileId, uniqueTxnRef]
      );

      await client.query(
        `UPDATE invoices SET paid_amount = paid_amount + 150.00 WHERE id = $1`,
        [invoiceId]
      );
    });

    const settledRecalc = await recalculateInvoice(invoiceId);
    expect(settledRecalc?.outstandingAmount).toBe(0.0);
    expect(settledRecalc?.status).toBe('PAID');

    // 11. Cryptographic Audit Blockchain Continuity on Live PostgreSQL
    const block = await appendAuditLog({
      tenantId: testTenantId,
      actorId: testFarmerUserId,
      actorRole: 'FARMER',
      entityType: 'INVOICE',
      entityId: invoiceId,
      action: 'SETTLED_IN_FULL',
      beforeState: { outstanding: 150.0 },
      afterState: { outstanding: 0.0, status: 'PAID' },
    });
    expect(block.currentHash).toBeDefined();
    expect(block.previousHash).toBeDefined();

    const auditVerification = await verifyAuditChain(testTenantId);
    expect(auditVerification.valid).toBe(true);
    expect(auditVerification.totalBlocks).toBeGreaterThanOrEqual(1);
  });
});
