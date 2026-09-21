import { transaction } from '../db';
import crypto from 'crypto';

export interface ProcessPaymentParams {
  invoiceId: string;
  customerId: string;
  farmerId: string;
  tenantId: string;
  amount: number;
  method?: string; // UPI, CASH, BANK_TRANSFER, CHEQUE
  transactionRef?: string; // Optional reference number
  notes?: string; // Additional notes
}

export interface PaymentResult {
  success: boolean;
  isDuplicate?: boolean;
  paymentId?: string;
  newOutstandingAmount?: number;
  newStatus?: string;
  error?: string;
}

/**
 * Verify a Razorpay checkout callback signature:
 *   HMAC_SHA256(order_id + '|' + payment_id, key_secret) == razorpay_signature
 * Uses timing-safe comparison. Returns false when the key secret is absent
 * (live verification impossible) so callers can fail closed.
 */
export function verifyRazorpayPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret?: string;
}): boolean {
  const secret = params.keySecret || process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !params.orderId || !params.paymentId || !params.signature) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(params.signature, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Simple payment recording for farmers.
 * Records manual payments via UPI, cash, bank transfer, etc.
 * No complex gateway integrations needed.
 */
export async function processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
  // FR-PAY-005/006: idempotency anchor + amount guards before any credit.
  const ref = (params.transactionRef || '').trim();
  if (!ref) {
    return { success: false, error: 'transactionRef is required' };
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return { success: false, error: 'amount must be a positive number' };
  }
  return transaction(async (client) => {
    // 1. Idempotency: duplicate provider reference returns current invoice state.
    const existing = await client.query(
      `SELECT id, amount, invoice_id FROM payments WHERE transaction_ref = $1`,
      [ref]
    );

    if (existing.rows.length > 0) {
      const invRes = await client.query(
        `SELECT outstanding_amount::float as "outstandingAmount", status FROM invoices WHERE id = $1`,
        [params.invoiceId]
      );
      return {
        success: true,
        isDuplicate: true,
        paymentId: existing.rows[0].id,
        newOutstandingAmount: invRes.rows[0]?.outstandingAmount,
        newStatus: invRes.rows[0]?.status,
      };
    }

    // 2. Fetch target invoice
    const invRes = await client.query(
      `SELECT id, total_amount::float as "totalAmount", paid_amount::float as "paidAmount"
       FROM invoices WHERE id = $1 FOR UPDATE`,
      [params.invoiceId]
    );

    if (invRes.rows.length === 0) {
      return { success: false, error: 'Invoice not found' };
    }

    const invoice = invRes.rows[0];
    // FR-PAY-006: partial payments allowed; overpayments are clamped to zero
    // outstanding (no negative balances) until an explicit credit-balance
    // model is introduced. Amount was already validated positive above.
    const newPaidAmount = invoice.paidAmount + params.amount;
    const newOutstanding = Math.max(0, invoice.totalAmount - newPaidAmount);
    const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const paymentId = crypto.randomUUID();

    // 3. Insert payment record
    await client.query(
      `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, method, transaction_ref, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUCCESS')`,
      [paymentId, params.tenantId, params.invoiceId, params.customerId, params.farmerId, params.amount, params.method || 'CASH', ref]
    );

    // 4. Update invoice amounts
    await client.query(
      `UPDATE invoices
       SET paid_amount = $1, outstanding_amount = $2, status = $3, updated_at = NOW()
       WHERE id = $4`,
      [newPaidAmount, newOutstanding, newStatus, params.invoiceId]
    );

    return {
      success: true,
      isDuplicate: false,
      paymentId,
      newOutstandingAmount: newOutstanding,
      newStatus,
    };
  });
}
