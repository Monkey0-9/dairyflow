import { query, transaction } from '../db';
import { Invoice, InvoiceStatus } from '../types';

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
  dueDate: string;
  customerName?: string;
  customerPhone?: string;
}

export async function getInvoices(params: {
  farmerId?: string;
  customerId?: string;
  tenantId?: string;
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
             i.status, i.due_date as "dueDate",
             u.name as "customerName", u.phone as "customerPhone"
      FROM invoices i
      JOIN customer_profiles c ON i.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const queryParams: any[] = [];
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
      `SELECT delivered_quantity::float as qty, price_per_unit::float as price
       FROM delivery_records
       WHERE customer_id = $1 AND date >= $2 AND date <= $3 AND status IN ('DELIVERED', 'PARTIAL', 'EXTRA')`,
      [params.customerId, startStr, endStr]
    );

    let totalQuantity = 0;
    let totalAmount = 0;
    for (const d of delRes.rows) {
      totalQuantity += d.qty;
      totalAmount += d.qty * d.price;
    }

    const invoiceId = `INV_${params.customerId}_${params.year}_${params.month}`;
    const dueDate = new Date(params.year, params.month, 5); // 5th of next month

    await client.query(
      `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.0, $8, 'UNPAID', $9)`,
      [invoiceId, params.tenantId, params.customerId, params.farmerId, params.month, params.year, totalQuantity, totalAmount, dueDate]
    );

    return { success: true, invoiceId };
  });
}
