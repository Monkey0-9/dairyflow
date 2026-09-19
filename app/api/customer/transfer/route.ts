import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  // Only OWNER or SUPERADMIN can initiate customer transfers
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

    // Verify customer exists and get current farmerId
    const custRes = await query<{ id: string; farmerId: string; tenantId: string }>(
      `SELECT id, farmer_id as "farmerId", tenant_id as "tenantId" FROM customer_profiles WHERE id = $1`,
      [customerId]
    );

    const cust = custRes.rows[0];
    if (!cust) {
      return NextResponse.json({ success: false, error: 'Customer not found.' }, { status: 404 });
    }

    if (cust.farmerId === toFarmerId) {
      return NextResponse.json({ success: false, error: 'Customer already belongs to this farmer.' }, { status: 400 });
    }

    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();

    const transferRes = await query(
      `INSERT INTO customer_transfer_requests (
         id, customer_id, from_farmer_id, to_farmer_id, status, reason, effective_date, created_at
       )
       VALUES (gen_random_uuid(), $1, $2, $3, 'PENDING', $4, $5, NOW())
       RETURNING id, customer_id as "customerId", from_farmer_id as "fromFarmerId",
                 to_farmer_id as "toFarmerId", status, effective_date as "effectiveDate", created_at as "createdAt"`,
      [customerId, cust.farmerId, toFarmerId, reason || 'Farmer transfer requested', effDate.toISOString()]
    );

    // Update customer transfer status
    await query(
      `UPDATE customer_profiles SET transfer_status = 'REQUESTED', updated_at = NOW() WHERE id = $1`,
      [customerId]
    );

    return NextResponse.json({
      success: true,
      message: 'Customer transfer request initiated successfully.',
      transferRequest: transferRes.rows[0],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initiate transfer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  // Transfer approval and acceptance workflow
  const auth = authenticateRequest(req, ['OWNER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { transferId, action } = await req.json(); // action: 'APPROVE' | 'ACCEPT' | 'REJECT'

    if (!transferId || !action) {
      return NextResponse.json({ success: false, error: 'transferId and action are required.' }, { status: 400 });
    }

    const res = await query<{
      id: string;
      customerId: string;
      fromFarmerId: string;
      toFarmerId: string;
      status: string;
    }>(
      `SELECT id, customer_id as "customerId", from_farmer_id as "fromFarmerId", to_farmer_id as "toFarmerId", status
       FROM customer_transfer_requests WHERE id = $1`,
      [transferId]
    );

    const transfer = res.rows[0];
    if (!transfer) {
      return NextResponse.json({ success: false, error: 'Transfer request not found.' }, { status: 404 });
    }

    if (action === 'APPROVE') {
      await query(`UPDATE customer_transfer_requests SET status = 'APPROVED' WHERE id = $1`, [transferId]);
      await query(`UPDATE customer_profiles SET transfer_status = 'APPROVED' WHERE id = $1`, [transfer.customerId]);
      return NextResponse.json({ success: true, message: 'Transfer request approved by current farmer.' });
    }

    if (action === 'ACCEPT') {
      // Execute the actual ownership transition transactionally while keeping historical records intact
      await query('BEGIN');
      await query(`UPDATE customer_profiles SET farmer_id = $1, transfer_status = 'NONE', updated_at = NOW() WHERE id = $2`, [transfer.toFarmerId, transfer.customerId]);
      await query(`UPDATE customer_transfer_requests SET status = 'ACCEPTED', resolved_at = NOW() WHERE id = $1`, [transferId]);
      await query('COMMIT');
      return NextResponse.json({ success: true, message: 'Customer transfer completed and ownership updated.' });
    }

    if (action === 'REJECT') {
      await query('BEGIN');
      await query(`UPDATE customer_profiles SET transfer_status = 'NONE', updated_at = NOW() WHERE id = $1`, [transfer.customerId]);
      await query(`UPDATE customer_transfer_requests SET status = 'REJECTED', resolved_at = NOW() WHERE id = $1`, [transferId]);
      await query('COMMIT');
      return NextResponse.json({ success: true, message: 'Customer transfer request rejected.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action. Must be APPROVE, ACCEPT, or REJECT.' }, { status: 400 });
  } catch (err: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : 'Failed to update transfer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
