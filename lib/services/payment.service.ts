import { query, transaction } from '../db';

export interface ProcessPaymentParams {
  invoiceId: string;
  customerId: string;
  farmerId: string;
  tenantId: string;
  amount: number;
  method?: string;
  transactionRef: string;
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
 * Idempotent payment processing.
 * Strictly guarantees that duplicate transaction references do not record double payments.
 */
export async function processPayment(params: ProcessPaymentParams): Promise<PaymentResult> {
  return transaction(async (client) => {
    // 1. Check for existing payment with same transactionRef (Idempotency check)
    const existing = await client.query(
      `SELECT id, amount, invoice_id FROM payments WHERE transaction_ref = $1`,
      [params.transactionRef]
    );

    if (existing.rows.length > 0) {
      // Return cached/existing payment result idempotently
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
    const newPaidAmount = invoice.paidAmount + params.amount;
    const newOutstanding = Math.max(0, invoice.totalAmount - newPaidAmount);
    const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 3. Insert payment
    await client.query(
      `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, method, transaction_ref, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUCCESS')`,
      [paymentId, params.tenantId, params.invoiceId, params.customerId, params.farmerId, params.amount, params.method || 'UPI', params.transactionRef]
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
