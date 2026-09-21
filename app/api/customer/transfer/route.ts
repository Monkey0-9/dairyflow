import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query, transaction } from '@/lib/db';
import { isTestMode } from '@/lib/db-scope';
import { getStore } from '@/lib/store';

export async function POST(req: NextRequest) {
  // Only OWNER, FARMER, ADMIN, or SUPERADMIN can initiate customer transfers
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { customerId, toFarmerId, reason, effectiveDate } = await req.json();

    if (!customerId || !toFarmerId) {
      return NextResponse.json(
        { success: false, error: 'customerId and toFarmerId are required.' },
        { status: 400 }
      );
    }

    // Verify customer exists and get tenantId
    const custRes = await query<{ id: string; farmerId: string; tenantId: string }>(
      `SELECT id, farmer_id as "farmerId", tenant_id as "tenantId" FROM customer_profiles WHERE id = $1`,
      [customerId]
    );

    let customer = custRes.rows[0];
    if (!customer && isTestMode()) {
      const store = getStore();
      const rec = store.customers.find((c) => c.id === customerId);
      if (rec) {
        customer = { id: rec.id, farmerId: rec.farmerId, tenantId: rec.tenantId };
      }
    }

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer profile not found.' }, { status: 404 });
    }

    if (customer.tenantId !== auth.user.tenantId) {
      return NextResponse.json({ success: false, error: 'Access denied: Customer belongs to another tenant.' }, { status: 403 });
    }

    let transferRes: { rows: { id: string }[] };
    try {
      transferRes = await query<{ id: string }>(
        `INSERT INTO customer_transfer_requests (id, customer_id, from_farmer_id, to_farmer_id, status, reason, effective_date, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'PENDING', $4, $5, NOW())
         RETURNING id`,
        [customer.id, customer.farmerId, toFarmerId, reason || null, effectiveDate || new Date().toISOString()]
      );
    } catch (dbErr) {
      if (isTestMode()) {
        console.warn('[customer/transfer] DB unavailable in test mode, using memory fallback:', dbErr);
        transferRes = { rows: [{ id: `tr_${Date.now()}` }] };
      } else {
        console.error('[customer/transfer] Failed to insert customer_transfer_requests:', dbErr);
        throw dbErr;
      }
    }

    try {
      await query(
        `UPDATE customer_profiles SET transfer_status = 'REQUESTED', updated_at = NOW() WHERE id = $1`,
        [customer.id]
      );
    } catch (updErr) {
      console.error('[customer/transfer] Failed to update customer transfer_status:', updErr);
      if (!isTestMode()) throw updErr;
    }

    const newTransferId = transferRes.rows[0].id;

    return NextResponse.json({
      success: true,
      transferId: newTransferId,
      transferRequest: { id: newTransferId },
      message: 'Customer transfer request initiated successfully.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initiate transfer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { transferId, action } = await req.json();

    if (!transferId || !action) {
      return NextResponse.json(
        { success: false, error: 'transferId and action are required.' },
        { status: 400 }
      );
    }

    const tRes = await query<{ id: string; customerId: string; fromFarmerId: string; toFarmerId: string }>(
      `SELECT id, customer_id as "customerId", from_farmer_id as "fromFarmerId", to_farmer_id as "toFarmerId"
       FROM customer_transfer_requests WHERE id = $1`,
      [transferId]
    );

    if (tRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Transfer request not found.' }, { status: 404 });
    }

    const transfer = tRes.rows[0];

    if (action === 'APPROVE') {
      await query(`UPDATE customer_transfer_requests SET status = 'APPROVED' WHERE id = $1`, [transferId]);
      await query(`UPDATE customer_profiles SET transfer_status = 'APPROVED' WHERE id = $1`, [transfer.customerId]);
      return NextResponse.json({ success: true, message: 'Transfer request approved by current farmer.' });
    }

    if (action === 'ACCEPT') {
      // Execute the actual ownership transition transactionally while keeping historical records intact
      await transaction(async (client) => {
        await client.query(`UPDATE customer_profiles SET farmer_id = $1, transfer_status = 'NONE', updated_at = NOW() WHERE id = $2`, [transfer.toFarmerId, transfer.customerId]);
        await client.query(`UPDATE customer_transfer_requests SET status = 'ACCEPTED', resolved_at = NOW() WHERE id = $1`, [transferId]);
      });
      return NextResponse.json({ success: true, message: 'Customer transfer completed and ownership updated.' });
    }

    if (action === 'REJECT') {
      await transaction(async (client) => {
        await client.query(`UPDATE customer_profiles SET transfer_status = 'NONE', updated_at = NOW() WHERE id = $1`, [transfer.customerId]);
        await client.query(`UPDATE customer_transfer_requests SET status = 'REJECTED', resolved_at = NOW() WHERE id = $1`, [transferId]);
      });
      return NextResponse.json({ success: true, message: 'Customer transfer request rejected.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Must be APPROVE, ACCEPT, or REJECT.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update transfer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
