import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';
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

    const adjId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const adjAmount = Math.abs(amount);

    await query('BEGIN');
    await query(
      `INSERT INTO invoice_adjustments (id, invoice_id, type, amount, reason, authorized_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [adjId, invoiceId, type, adjAmount, reason, auth.user.name || auth.user.userId]
    );

    // Also add itemized line in invoice_items for transparency
    const itemAmount = type === 'CREDIT' ? -adjAmount : adjAmount;
    await query(
      `INSERT INTO invoice_items (id, invoice_id, date, description, quantity, rate, amount)
       VALUES ($1, $2, $3, $4, 1.0, $5, $6)`,
      [
        `item_${adjId}`,
        invoiceId,
        new Date().toISOString().slice(0, 10),
        `Adjustment (${type}): ${reason}`,
        itemAmount,
        itemAmount,
      ]
    );
    await query('COMMIT');

    // Authoritative recalculation of invoice
    const updatedInvoice = await recalculateInvoice(invoiceId);

    return NextResponse.json({
      success: true,
      message: `Invoice adjustment (${type} of ₹${adjAmount}) applied successfully.`,
      adjustmentId: adjId,
      updatedInvoice,
    });
  } catch (err: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : 'Failed to apply invoice adjustment';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
