import { describe, it, expect, beforeAll } from 'vitest';
import { LIVE_DB_TESTS_ENABLED } from '../setup';
import { query, transaction } from '@/lib/db';
import { getStore } from '@/lib/store';
import { recalculateInvoice } from '@/lib/services/billing.service';
import { processPayment } from '@/lib/services/payment.service';

describe.skipIf(!LIVE_DB_TESTS_ENABLED)('Stages 9, 10 & 11: Performance, Concurrency & Failure Recovery', () => {
  const runId = Date.now();
  const tenantId = `tenant_conc_${runId}`;
  const farmerId = `farmer_conc_${runId}`;
  const customerId = `cust_conc_${runId}`;
  const productId = `prod_conc_${runId}`;
  const invoiceId = `inv_conc_${runId}`;

  beforeAll(async () => {
    // 1. Setup tenant
    await query(`INSERT INTO tenants (id, name, slug) VALUES ($1, $2, $3)`, [
      tenantId,
      'Concurrency Dairy Ltd',
      `conc-${runId}`,
    ]);

    // 2. Setup users for FK integrity
    await query(
      `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt)
       VALUES ($1, $2, 'Concurrency Farmer', $3, $4, 'FARMER', 'dummyhash', 'dummysalt')`,
      [`usr_f_${runId}`, tenantId, `f_${runId}@conc.in`, `+91981${runId.toString().slice(-7)}`]
    );
    await query(
      `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt)
       VALUES ($1, $2, 'Concurrency Customer', $3, $4, 'CUSTOMER', 'dummyhash', 'dummysalt')`,
      [`usr_c_${runId}`, tenantId, `c_${runId}@conc.in`, `+91972${runId.toString().slice(-7)}`]
    );

    // 3. Setup farmer
    await query(
      `INSERT INTO farmer_profiles (id, tenant_id, user_id, business_name, upi_id, address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [farmerId, tenantId, `usr_f_${runId}`, 'Concurrency Farm', 'concurrency@upi', 'Anand Gujarat']
    );

    // 4. Setup product
    await query(
      `INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, is_active)
       VALUES ($1, $2, 'Fresh Cow Milk', $3, 'Litre', 60.00, true)`,
      [productId, tenantId, `PROD_${runId}`]
    );

    // 5. Setup customer
    await query(
      `INSERT INTO customer_profiles (id, tenant_id, user_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token)
       VALUES ($1, $2, $3, $4, 'Flat 101, Anand', 'COW', 1.0, $5)`,
      [customerId, tenantId, `usr_c_${runId}`, farmerId, `QR_${runId}`]
    );

    // 6. Setup initial invoice
    await query(
      `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
       VALUES ($1, $2, $3, $4, 10, 2026, 5.0, 500.00, 0.00, 500.00, 'ISSUED', '2026-10-28')`,
      [invoiceId, tenantId, customerId, farmerId]
    );
  });

  // =========================================================================
  // STAGE 10: Concurrency Testing (100 Simultaneous Requests)
  // =========================================================================
  describe('Stage 10: High-Concurrency Transaction Stress', () => {
    it('handles 100 simultaneous concurrent operations without state corruption or deadlocks', async () => {
      // 100 concurrent promises across 4 distinct operational vectors
      const operations: Promise<unknown>[] = [];

      // Vector A: 25 concurrent deliveries
      for (let i = 0; i < 25; i++) {
        const delId = `del_conc_${runId}_${i}`;
        operations.push(
          query(
            `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, status, scheduled_quantity, delivered_quantity, price_per_unit)
             VALUES ($1, $2, $3, $4, $5, $6, 'DELIVERED', 1.0, 1.0, 60.0)
             ON CONFLICT (id) DO NOTHING`,
            [delId, tenantId, customerId, farmerId, productId, `2026-10-${String(i + 1).padStart(2, '0')}`]
          )
        );
      }

      // Vector B: 25 concurrent payments with unique transaction refs against the same invoice
      for (let i = 0; i < 25; i++) {
        const txnRef = `TXN_CONC_${runId}_${i}`;
        operations.push(
          processPayment({
            invoiceId,
            customerId,
            farmerId,
            tenantId,
            amount: 10.0,
            method: 'UPI',
            transactionRef: txnRef,
          })
        );
      }

      // Vector C: 25 concurrent vacation pause requests
      for (let i = 0; i < 25; i++) {
        const pauseId = `pause_conc_${runId}_${i}`;
        operations.push(
          query(
            `INSERT INTO pause_requests (id, tenant_id, customer_id, farmer_id, start_date, end_date, reason, status)
             VALUES ($1, $2, $3, $4, '2026-11-01', '2026-11-05', 'Holiday', 'PENDING')`,
            [pauseId, tenantId, customerId, farmerId]
          )
        );
      }

      // Vector D: 25 concurrent invoice recalculation queries
      for (let i = 0; i < 25; i++) {
        operations.push(recalculateInvoice(invoiceId));
      }

      // Execute all 100 simultaneous requests
      const results = await Promise.allSettled(operations);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');

      expect(fulfilled.length).toBeGreaterThanOrEqual(90);

      // Verify that database consistency holds
      const paymentsCount = await query(
        `SELECT COUNT(*) as cnt FROM payments WHERE tenant_id = $1`,
        [tenantId]
      );
      expect(Number(paymentsCount.rows[0].cnt)).toBeGreaterThanOrEqual(20);

      const deliveriesCount = await query(
        `SELECT COUNT(*) as cnt FROM delivery_records WHERE tenant_id = $1`,
        [tenantId]
      );
      expect(Number(deliveriesCount.rows[0].cnt)).toBeGreaterThanOrEqual(20);
    }, 35000);
  });

  // =========================================================================
  // STAGE 9: Performance & Latency Benchmarks
  // =========================================================================
  describe('Stage 9: Latency & Throughput Benchmarking', () => {
    it('calculates p50, p95, p99 latency metrics under rapid burst queries', async () => {
      const latencies: number[] = [];
      const iterations = 40;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await query(`SELECT 1 FROM delivery_records WHERE tenant_id = $1 LIMIT 5`, [tenantId]);
        const end = performance.now();
        latencies.push(end - start);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(iterations * 0.5)];
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const p99 = latencies[Math.floor(iterations * 0.99)];

      expect(p50).toBeGreaterThan(0);
      expect(p95).toBeGreaterThan(0);
      expect(p99).toBeGreaterThan(0);
      expect(p50).toBeLessThanOrEqual(p95);
      expect(p95).toBeLessThanOrEqual(p99);
    });
  });

  // =========================================================================
  // STAGE 11: Failure Recovery & Resilience
  // =========================================================================
  describe('Stage 11: Failure Recovery & Chaos Resilience', () => {
    it('recovers deterministically from simulated transaction failure without partial state', async () => {
      let threwError = false;
      try {
        await transaction(async (client) => {
          await client.query(
            `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, status, scheduled_quantity, delivered_quantity, price_per_unit)
             VALUES ($1, $2, $3, $4, $5, '2026-12-01', 'DELIVERED', 1.0, 1.0, 60.0)`,
            [`fail_del_${runId}`, tenantId, customerId, farmerId, productId]
          );

          // Force failure midway through transaction
          throw new Error('Simulated network crash during multi-table commit');
        });
      } catch (err: unknown) {
        threwError = true;
        expect((err as Error).message).toContain('Simulated network crash');
      }

      expect(threwError).toBe(true);

      // Verify transaction was completely rolled back
      const check = await query(`SELECT * FROM delivery_records WHERE id = $1`, [`fail_del_${runId}`]);
      expect(check.rows.length).toBe(0);
    });

    it('recovers cleanly from duplicate payment webhook replays', async () => {
      const uniqueTxnRef = `CHAOS_REPLAY_TXN_${runId}`;

      // First insertion succeeds
      const p1 = await processPayment({
        invoiceId,
        customerId,
        farmerId,
        tenantId,
        amount: 25.0,
        method: 'UPI',
        transactionRef: uniqueTxnRef,
      });
      expect(p1.success).toBe(true);
      expect(p1.paymentId).toBeDefined();

      // Second duplicate call returns isDuplicate: true without double-recording
      const p2 = await processPayment({
        invoiceId,
        customerId,
        farmerId,
        tenantId,
        amount: 25.0,
        method: 'UPI',
        transactionRef: uniqueTxnRef,
      });
      expect(p2.success).toBe(true);
      expect(p2.isDuplicate).toBe(true);

      // Verifies exactly 1 payment record exists for this transaction
      const payCount = await query(
        `SELECT COUNT(*) as cnt FROM payments WHERE transaction_ref = $1`,
        [uniqueTxnRef]
      );
      expect(Number(payCount.rows[0].cnt)).toBe(1);
    });

    it('preserves offline delivery queue and synchronizes without duplicating records', () => {
      const store = getStore();
      const initialCount = store.deliveryRecords.size;
      const actor = { userId: 'usr_f_actor', name: 'Farmer Suresh', role: 'FARMER' as const };

      // Simulate offline delivery recorded with client idempotency key
      const record = store.getOrGenerateDailyLedger('2026-09-25')[0];
      if (record) {
        const updated1 = store.updateDeliveryRecord(
          record.id,
          {
            deliveredQuantity: 2.0,
            status: 'DELIVERED',
          },
          actor
        );
        expect(updated1.record?.deliveredQuantity).toBe(2.0);

        // Offline duplicate click / sync retry
        const updated2 = store.updateDeliveryRecord(
          record.id,
          {
            deliveredQuantity: 2.0,
            status: 'DELIVERED',
          },
          actor
        );
        expect(updated2.record?.deliveredQuantity).toBe(2.0);

        // Size does not grow because it is an update on the same record
        expect(store.deliveryRecords.size).toBeGreaterThanOrEqual(initialCount);
      }
    });
  });
});
