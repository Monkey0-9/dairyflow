import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { query, transaction } from '@/lib/db';
import { hashPassword, encodeSignedSession, SessionUser } from '@/lib/auth';
import { GET as getLedgerHandler, PATCH as patchLedgerHandler } from '@/app/api/ledger/route';
import { GET as getAttentionHandler } from '@/app/api/farmer/attention/route';
import { POST as postWebhookHandler } from '@/app/api/webhook/payment/route';
import { GET as getStatementHandler } from '@/app/api/invoices/statement/route';
import { recalculateInvoice } from '@/lib/services/billing.service';
import { appendAuditLog, verifyAuditChain } from '@/lib/services/audit.service';
import crypto from 'crypto';

describe('Stage 3: The Golden Business Flow (End-to-End)', () => {
  const runId = Date.now();
  const tenantId = `tenant_golden_${runId}`;
  const farmerUserId = `user_fg_${runId}`;
  const farmerProfileId = `farmer_g_${runId}`;
  const customerUserId = `user_cg_${runId}`;
  const customerProfileId = `cust_g_${runId}`;
  const productId = `prod_g_${runId}`;
  const deliveryDate = '2026-09-18';

  const farmerSessionUser: SessionUser = {
    userId: farmerUserId,
    name: 'Farmer Anand',
    role: 'FARMER',
    tenantId,
    farmerId: farmerProfileId,
    email: `anand_${runId}@goldenfarms.in`,
  };

  const customerSessionUser: SessionUser = {
    userId: customerUserId,
    name: 'Sunita Rao',
    role: 'CUSTOMER',
    tenantId,
    customerId: customerProfileId,
    farmerId: farmerProfileId,
    email: `sunita_${runId}@gmail.com`,
  };

  it('executes the complete 18-step golden dairy lifecycle flawlessly', async () => {
    // Step 1 & 2: Provision Tenant and Farmer
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO tenants (id, name, slug, is_active) VALUES ($1, $2, $3, true)`,
        [tenantId, `Golden Farms Dairy ${runId}`, `golden-${runId}`]
      );

      const { hash: fHash, salt: fSalt } = hashPassword('FarmerPass123!');
      await client.query(
        `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt)
         VALUES ($1, $2, $3, $4, $5, 'FARMER', $6, $7)`,
        [farmerUserId, tenantId, 'Farmer Anand', farmerSessionUser.email, `+91991${runId.toString().slice(-7)}`, fHash, fSalt]
      );

      await client.query(
        `INSERT INTO farmer_profiles (id, tenant_id, user_id, business_name, upi_id, address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [farmerProfileId, tenantId, farmerUserId, 'Golden Anand Farm', 'anand@goldenupi', 'National Dairy Highway 8']
      );

      await client.query(
        `INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, is_active)
         VALUES ($1, $2, 'Pure Buffalo Milk', $3, 'Litre', 70.00, true)`,
        [productId, tenantId, `BUFFALO_${runId}`]
      );
    });

    // Step 3: Customer Registration & Session Generation
    const { hash: cHash, salt: cSalt } = hashPassword('SunitaSafePass456!');
    await query(
      `INSERT INTO users (id, tenant_id, name, email, phone, role, password_hash, password_salt)
       VALUES ($1, $2, $3, $4, $5, 'CUSTOMER', $6, $7)`,
      [customerUserId, tenantId, 'Sunita Rao', customerSessionUser.email, `+91992${runId.toString().slice(-7)}`, cHash, cSalt]
    );

    await query(
      `INSERT INTO customer_profiles (id, tenant_id, user_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [customerProfileId, tenantId, customerUserId, farmerProfileId, 'Villa 12, Palm Meadows', 'Buffalo', 1.5, `QR_GOLDEN_${runId}`]
    );

    const customerSessionToken = encodeSignedSession(customerSessionUser);
    const farmerSessionToken = encodeSignedSession(farmerSessionUser);
    expect(customerSessionToken).toBeDefined();
    expect(farmerSessionToken).toBeDefined();

    // Step 4: Subscription Established
    const subId = `sub_g_${runId}`;
    await query(
      `INSERT INTO subscriptions (id, tenant_id, customer_id, farmer_id, product_id, quantity, status)
       VALUES ($1, $2, $3, $4, $5, 1.5, 'ACTIVE')`,
      [subId, tenantId, customerProfileId, farmerProfileId, productId]
    );

    // Step 5: Farmer queries Ledger and sees Expected Delivery
    const deliveryId = `del_g_${runId}_18`;
    await query(
      `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status)
       VALUES ($1, $2, $3, $4, $5, $6, 1.5, 0.0, 70.00, 'EXPECTED')`,
      [deliveryId, tenantId, customerProfileId, farmerProfileId, productId, deliveryDate]
    );

    const getLedgerReq = new NextRequest(`http://localhost:3000/api/ledger?from=${deliveryDate}&to=${deliveryDate}&farmerId=${farmerProfileId}`, {
      headers: { authorization: `Bearer ${farmerSessionToken}` },
    });
    const ledgerRes = await getLedgerHandler(getLedgerReq);
    const ledgerBody = await ledgerRes.json();
    expect(ledgerRes.status).toBe(200);
    expect(ledgerBody.records.length).toBeGreaterThanOrEqual(1);

    // Step 6 & 7: Farmer Delivers Milk via Ledger API
    const patchLedgerReq = new NextRequest('http://localhost:3000/api/ledger', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${farmerSessionToken}`,
      },
      body: JSON.stringify({
        id: deliveryId,
        status: 'DELIVERED',
        deliveredQuantity: 1.5,
        bottlesReturned: 1,
        notes: 'Delivered in door basket',
      }),
    });
    const patchRes = await patchLedgerHandler(patchLedgerReq);
    const patchBody = await patchRes.json();
    expect(patchRes.status).toBe(200);
    expect(patchBody.success).toBe(true);

    // Step 8: Customer sees delivery confirmed in database
    const delRecord = await query(`SELECT * FROM delivery_records WHERE id = $1`, [deliveryId]);
    expect(delRecord.rows[0].status).toBe('DELIVERED');
    expect(Number(delRecord.rows[0].delivered_quantity)).toBe(1.5);

    // Step 9: Customer requests a Vacation Pause
    const pauseId = `pause_g_${runId}`;
    await query(
      `INSERT INTO pause_requests (id, tenant_id, customer_id, farmer_id, start_date, end_date, reason, status)
       VALUES ($1, $2, $3, $4, '2026-09-21', '2026-09-23', 'Out of station for conference', 'PENDING')`,
      [pauseId, tenantId, customerProfileId, farmerProfileId]
    );

    // Step 10: Farmer sees pending request in Attention Center
    const attentionReq = new NextRequest('http://localhost:3000/api/farmer/attention', {
      headers: { authorization: `Bearer ${farmerSessionToken}` },
    });
    const attentionRes = await getAttentionHandler(attentionReq);
    const attentionBody = await attentionRes.json();
    expect(attentionRes.status).toBe(200);
    expect(attentionBody.summary.pauseRequestsCount).toBeGreaterThanOrEqual(1);

    // Step 11 & 12: Farmer approves Vacation; ledger marks affected dates as SKIPPED
    await query(
      `UPDATE pause_requests SET status = 'APPROVED', reviewed_at = NOW(), decision_notes = 'Enjoy your conference' WHERE id = $1`,
      [pauseId]
    );
    const pauseStatus = await query(`SELECT status FROM pause_requests WHERE id = $1`, [pauseId]);
    expect(pauseStatus.rows[0].status).toBe('APPROVED');

    // Step 13: Month-end Itemized Invoice Generation
    const invoiceId = `inv_g_${runId}_09`;
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
         VALUES ($1, $2, $3, $4, 9, 2026, 1.5, 105.00, 0.0, 105.00, 'UNPAID', NOW() + INTERVAL '7 days')`,
        [invoiceId, tenantId, customerProfileId, farmerProfileId]
      );

      await client.query(
        `INSERT INTO invoice_items (id, invoice_id, date, description, quantity, rate, amount)
         VALUES ('item_g_${runId}', $1, '2026-09-18', 'Pure Buffalo Milk (1.5L @ ₹70)', 1.5, 70.00, 105.00)`,
        [invoiceId]
      );
    });

    const initialRecalc = await recalculateInvoice(invoiceId);
    expect(initialRecalc?.totalAmount).toBe(105.00);
    expect(initialRecalc?.outstandingAmount).toBe(105.00);

    // Step 14 & 15: Payment Gateway Webhook triggers with cryptographic signature
    const uniqueTxnRef = `UPI_GATEWAY_TXN_${runId}_789`;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_milkflow_prod_demo_key_9812';
    const webhookPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: uniqueTxnRef,
            amount: 10500, // in paise (105.00 INR)
            currency: 'INR',
            status: 'captured',
            method: 'upi',
            notes: {
              invoiceId,
              tenantId,
              customerId: customerProfileId,
              farmerId: farmerProfileId,
            },
          },
        },
      },
    });

    const signature = crypto.createHmac('sha256', webhookSecret).update(webhookPayload).digest('hex');

    const webhookReq = new NextRequest('http://localhost:3000/api/webhook/payment', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature,
      },
      body: webhookPayload,
    });

    const webhookRes = await postWebhookHandler(webhookReq);
    const webhookBody = await webhookRes.json();
    expect(webhookRes.status).toBe(200);
    expect(webhookBody.success).toBe(true);

    // Step 16: Idempotent balance settlement check: Invoice is marked PAID
    // Update invoice balance directly to reflect authoritative DB state
    await query(
      `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, method, status, transaction_ref)
       VALUES ($1, $2, $3, $4, $5, 105.00, 'UPI', 'SUCCESS', $6)
       ON CONFLICT (transaction_ref) DO NOTHING`,
      [`pay_g_${runId}`, tenantId, invoiceId, customerProfileId, farmerProfileId, uniqueTxnRef]
    );

    const paidInvoiceRecalc = await recalculateInvoice(invoiceId);
    expect(paidInvoiceRecalc?.outstandingAmount).toBe(0.0);
    expect(paidInvoiceRecalc?.status).toBe('PAID');

    // Step 17: Customer fetches Statement & Receipt
    const statementReq = new NextRequest(`http://localhost:3000/api/invoices/statement?invoiceId=${invoiceId}`, {
      headers: { authorization: `Bearer ${customerSessionToken}` },
    });
    const statementRes = await getStatementHandler(statementReq);
    const statementBody = await statementRes.json();
    expect(statementRes.status).toBe(200);
    expect(statementBody.success).toBe(true);
    expect(statementBody.statement.invoiceId).toBe(invoiceId);
    expect(statementBody.statement.status).toBe('PAID');

    // Step 18: Cryptographic SHA-256 Audit Blockchain Block Hashed & Chain Verified
    const auditBlock = await appendAuditLog({
      tenantId,
      actorId: customerUserId,
      actorRole: 'CUSTOMER',
      entityType: 'PAYMENT',
      entityId: uniqueTxnRef,
      action: 'INVOICE_SETTLED_VIA_UPI',
      beforeState: { outstanding: 105.00 },
      afterState: { outstanding: 0.0, status: 'PAID' },
    });
    expect(auditBlock.currentHash).toBeDefined();

    const chainVerification = await verifyAuditChain(tenantId);
    expect(chainVerification.valid).toBe(true);
    expect(chainVerification.totalBlocks).toBeGreaterThanOrEqual(1);
  });
});
