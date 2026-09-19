import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const { primaryCustomerId, secondaryCustomerId } = await req.json();

    if (!primaryCustomerId || !secondaryCustomerId) {
      return NextResponse.json(
        { success: false, error: 'primaryCustomerId and secondaryCustomerId are required.' },
        { status: 400 }
      );
    }

    if (primaryCustomerId === secondaryCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Cannot merge a customer into itself.' },
        { status: 400 }
      );
    }

    // Verify both customers exist
    const primary = await query('SELECT id FROM customer_profiles WHERE id = $1', [primaryCustomerId]);
    const secondary = await query('SELECT id FROM customer_profiles WHERE id = $1', [secondaryCustomerId]);

    if (primary.rows.length === 0 || secondary.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'One or both customers do not exist.' }, { status: 404 });
    }

    // Transactional merge: Re-link relations to primary, soft-close secondary profile, and log audit event
    await query('BEGIN');

    // 1. Re-link delivery records
    await query('UPDATE delivery_records SET customer_id = $1 WHERE customer_id = $2', [primaryCustomerId, secondaryCustomerId]);

    // 2. Re-link invoices & payments
    await query('UPDATE invoices SET customer_id = $1 WHERE customer_id = $2', [primaryCustomerId, secondaryCustomerId]);
    await query('UPDATE payments SET customer_id = $1 WHERE customer_id = $2', [primaryCustomerId, secondaryCustomerId]);

    // 3. Re-link requests
    await query('UPDATE pause_requests SET customer_id = $1 WHERE customer_id = $2', [primaryCustomerId, secondaryCustomerId]);
    await query('UPDATE extra_milk_requests SET customer_id = $1 WHERE customer_id = $2', [primaryCustomerId, secondaryCustomerId]);

    // 4. Mark secondary customer as CLOSED / MERGED
    await query(
      `UPDATE customer_profiles SET status = 'CLOSED', is_active = false, updated_at = NOW() WHERE id = $1`,
      [secondaryCustomerId]
    );

    // 5. Create CustomerMergeLog
    await query(
      `INSERT INTO customer_merge_logs (id, primary_customer_id, merged_customer_id, performed_by, merged_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW())`,
      [primaryCustomerId, secondaryCustomerId, auth.user.name || auth.user.userId]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: `Customer ${secondaryCustomerId} successfully merged into primary customer ${primaryCustomerId}.`,
    });
  } catch (err: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : 'Customer merge failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
