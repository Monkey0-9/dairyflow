import { query, transaction } from '../db';
import { InvoiceStatus } from '../types';

export interface DbInvoice {
  id: string;
  tenantId: string;
  customerId: string;
  farmerId: string;
  month: number;
  year: number;
  totalQuantity: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
  dueDate?: string;
  notes?: string;
  generatedAt: string;
  customerName?: string;
  customerPhone?: string;
}

export async function getInvoices(params: {
  tenantId?: string;
  farmerId?: string;
  customerId?: string;
  month?: number;
  year?: number;
}): Promise<DbInvoice[]> {
  try {
    let sql = `
      SELECT i.id, i.tenant_id as "tenantId", i.customer_id as "customerId",
             i.farmer_id as "farmerId", i.month, i.year,
             i.total_quantity::float as "totalQuantity",
             i.total_amount::float as "totalAmount",
             i.paid_amount::float as "paidAmount",
             i.outstanding_amount::float as "outstandingAmount",
             i.status, i.notes, i.due_date as "dueDate", i.generated_at as "generatedAt",
             u.name as "customerName", u.phone as "customerPhone"
      FROM invoices i
      JOIN customer_profiles c ON i.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const queryParams: unknown[] = [];
    if (params.farmerId) {
      queryParams.push(params.farmerId);
      sql += ` AND i.farmer_id = $${queryParams.length}`;
    }
    if (params.customerId) {
      queryParams.push(params.customerId);
      sql += ` AND i.customer_id = $${queryParams.length}`;
    }
    if (params.tenantId) {
      queryParams.push(params.tenantId);
      sql += ` AND i.tenant_id = $${queryParams.length}`;
    }
    if (params.month) {
      queryParams.push(params.month);
      sql += ` AND i.month = $${queryParams.length}`;
    }
    if (params.year) {
      queryParams.push(params.year);
      sql += ` AND i.year = $${queryParams.length}`;
    }
    sql += ` ORDER BY i.year DESC, i.month DESC, u.name ASC`;

    const res = await query<DbInvoice>(sql, queryParams);
    return res.rows;
  } catch (err) {
    console.error('[BillingService] getInvoices error:', err);
    return [];
  }
}

/**
 * Generate monthly invoice for a customer.
 * Enforces UNIQUE(customerId, month, year) database constraint.
 */
export async function generateMonthlyInvoice(params: {
  customerId: string;
  farmerId: string;
  tenantId: string;
  month: number;
  year: number;
}): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  return transaction(async (client) => {
    // 1. Check if invoice already exists
    const existing = await client.query(
      `SELECT id FROM invoices WHERE customer_id = $1 AND month = $2 AND year = $3`,
      [params.customerId, params.month, params.year]
    );
    if (existing.rows.length > 0) {
      return { success: false, error: `Invoice already exists for month ${params.month}/${params.year}` };
    }

    // 2. Fetch all billable deliveries for this month
    const startStr = `${params.year}-${String(params.month).padStart(2, '0')}-01`;
    const endStr = `${params.year}-${String(params.month).padStart(2, '0')}-31`;

    const delRes = await client.query(
      `SELECT id, date, delivered_quantity::float as qty, price_per_unit::float as price
       FROM delivery_records
       WHERE customer_id = $1 AND date >= $2 AND date <= $3 AND status IN ('DELIVERED', 'PARTIAL', 'EXTRA')
       ORDER BY date ASC`,
      [params.customerId, startStr, endStr]
    );

    let totalQuantity = 0;
    let totalAmount = 0;
    const invoiceId = `INV_${params.customerId}_${params.year}_${params.month}`;
    const dueDate = new Date(params.year, params.month, 5); // 5th of next month

    for (const d of delRes.rows) {
      totalQuantity += d.qty;
      const lineAmt = d.qty * d.price;
      totalAmount += lineAmt;
    }

    await client.query(
      `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.0, $8, 'UNPAID', $9)`,
      [invoiceId, params.tenantId, params.customerId, params.farmerId, params.month, params.year, totalQuantity, totalAmount, dueDate]
    );

    // 3. Populate itemized invoice items
    for (const d of delRes.rows) {
      const lineAmt = d.qty * d.price;
      const itemId = `ITEM_${d.id}_${Date.now()}`;
      await client.query(
        `INSERT INTO invoice_items (id, invoice_id, date, description, quantity, rate, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [itemId, invoiceId, d.date, `Daily milk delivery on ${d.date}`, d.qty, d.price, lineAmt]
      );
    }

    return { success: true, invoiceId };
  });
}

/**
 * Authoritative recalculation of invoice amounts and payment status.
 * Enforces the core accounting invariants:
 * Total = sum(item quantity * item rate) - adjustments
 * Outstanding = max(0, Total - sum(successful payments))
 */
export async function recalculateInvoice(invoiceId: string): Promise<{
  totalQuantity: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: InvoiceStatus;
}> {
  return transaction(async (client) => {
    // 1. Sum up all invoice items
    const itemsRes = await client.query(
      `SELECT COALESCE(SUM(quantity::float), 0) as "totalQuantity",
              COALESCE(SUM(amount::float), 0) as "totalAmount"
       FROM invoice_items WHERE invoice_id = $1`,
      [invoiceId]
    );
    const totalQuantity = itemsRes.rows[0].totalQuantity;
    const totalAmount = itemsRes.rows[0].totalAmount;

    // 2. Sum up all successful payments
    const payRes = await client.query(
      `SELECT COALESCE(SUM(amount::float), 0) as "paidAmount"
       FROM payments WHERE invoice_id = $1 AND status = 'SUCCESS'`,
      [invoiceId]
    );
    const paidAmount = payRes.rows[0].paidAmount;
    const outstandingAmount = Math.max(0, totalAmount - paidAmount);
    const status: InvoiceStatus = outstandingAmount <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

    // 3. Update the invoice record atomically
    await client.query(
      `UPDATE invoices
       SET total_quantity = $1, total_amount = $2, paid_amount = $3, outstanding_amount = $4, status = $5, updated_at = NOW()
       WHERE id = $6`,
      [totalQuantity, totalAmount, paidAmount, outstandingAmount, status, invoiceId]
    );

    return { totalQuantity, totalAmount, paidAmount, outstandingAmount, status };
  });
}
