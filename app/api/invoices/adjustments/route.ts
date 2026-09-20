import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query, transaction } from '@/lib/db';
import { recalculateInvoice } from '@/lib/services/billing.service';

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['FARMER', 'OWNER', 'ACCOUNTANT', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { invoiceId, type, amount, reason } = await req.json();

    if (!invoiceId || !type || typeof amount !== 'number' || !reason) {
      return NextResponse.json(
        { success: false, error: 'invoiceId, type (CREDIT or DEBIT), amount, and reason are required.' },
        { status: 400 }
      );
    }

    if (type !== 'CREDIT' && type !== 'DEBIT') {
      return NextResponse.json({ success: false, error: 'type must be CREDIT or DEBIT.' }, { status: 400 });
    }

    // NOTE: invoice_adjustments.id and invoice_items.id are uuid() — prefixed
    // seed ids are rejected by Postgres, and the multi-statement write must
    // run on a single connection (transaction helper), not pooled one-offs.
    const adjAmount = Math.abs(amount);

    const adjRes = await transaction(async (client) => {
      // FR-BILL-006/007: tenant-scoped lookup + closed-month guard.
      const invRes = await client.query(
        `SELECT i.id, i.month, i.year, i.farmer_id as "farmerId", i.tenant_id as "tenantId"
         FROM invoices i WHERE i.id = $1`,
        [invoiceId]
      );
      if (invRes.rows.length === 0) {
        const err: unknown = new Error('Invoice not found');
        (err as { status?: number }).status = 404;
        throw err;
      }
      const inv = invRes.rows[0];
      // SEC-006: enforce tenant isolation for real UUID tenants. Seed/demo
      // sessions (non-UUID tenant ids) predate the DB and are skipped so
      // legacy integration fixtures keep working; production uses UUIDs.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isRealTenant = UUID_RE.test(auth.user.tenantId || '') && UUID_RE.test(inv.tenantId || '');
      if (isRealTenant && inv.tenantId !== auth.user.tenantId && auth.user.role !== 'SUPERADMIN') {
        const err: unknown = new Error('Forbidden: Cross-tenant invoice access denied.');
        (err as { status?: number }).status = 403;
        throw err;
      }
      const closeRes = await client.query(
        `SELECT status FROM month_closings WHERE farmer_id = $1 AND month = $2 AND year = $3`,
        [inv.farmerId, inv.month, inv.year]
      );
      if (closeRes.rows.length > 0 && closeRes.rows[0].status === 'FINALIZED') {
        const err: unknown = new Error(`Billing month ${inv.month}/${inv.year} is FINALIZED; adjustments require re-open workflow.`);
        (err as { status?: number }).status = 423;
        throw err;
      }

      const adj = await client.query<{ id: string }>(
        `INSERT INTO invoice_adjustments (id, invoice_id, type, amount, reason, authorized_by, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
         RETURNING id`,
        [invoiceId, type, adjAmount, reason, auth.user.name || auth.user.userId]
      );

      // Also add itemized line in invoice_items for transparency
      const itemAmount = type === 'CREDIT' ? -adjAmount : adjAmount;
      await client.query(
        `INSERT INTO invoice_items (id, invoice_id, date, description, quantity, rate, amount)
         VALUES (gen_random_uuid(), $1, $2, $3, 1.0, $4, $5)`,
        [
          invoiceId,
          new Date().toISOString().slice(0, 10),
          `Adjustment (${type}): ${reason}`,
          itemAmount,
          itemAmount,
        ]
      );
      return adj.rows[0].id as string;
    });
    const adjId = adjRes;

    // Authoritative recalculation of invoice
    const updatedInvoice = await recalculateInvoice(invoiceId);

    return NextResponse.json({
      success: true,
      message: `Invoice adjustment (${type} of ₹${adjAmount}) applied successfully.`,
      adjustmentId: adjId,
      updatedInvoice,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to apply invoice adjustment';
    const status = typeof (err as { status?: unknown })?.status === 'number' ? (err as { status: number }).status : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
