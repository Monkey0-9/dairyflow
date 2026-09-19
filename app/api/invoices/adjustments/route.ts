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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
