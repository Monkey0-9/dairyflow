import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req, ['CUSTOMER']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const custId = auth.user.customerId;
    if (!custId) {
      return NextResponse.json({ success: false, error: 'Customer profile not found' }, { status: 404 });
    }

    const res = await query(
      `SELECT c.id, c.user_id as "userId", c.tenant_id as "tenantId", c.farmer_id as "farmerId",
              c.delivery_address as "deliveryAddress", c.milk_type as "milkType",
              c.daily_quantity::float as "dailyQuantity", c.status, c.transfer_status as "transferStatus",
              u.name, u.phone, u.email
      FROM customer_profiles c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = $1`,
      [custId]
    );

    const profile = res.rows[0];
    if (!profile) {
      return NextResponse.json({ success: false, error: 'Customer profile not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req, ['CUSTOMER']);
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const custId = auth.user.customerId;
    if (!custId) {
      return NextResponse.json({ success: false, error: 'Customer profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { name, phone, deliveryAddress, email } = body;

    // IMMUTABILITY SECURITY GUARD:
    // Reject any malicious payload attempting to modify farmerId, tenantId, status, dailyQuantity, or milkType!
    if ('farmerId' in body || 'tenantId' in body || 'dailyQuantity' in body || 'milkType' in body || 'status' in body) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Customers cannot alter farmer assignment, tenant identity, status, or subscription parameters.',
        },
        { status: 403 }
      );
    }

    if (!name && !phone && !deliveryAddress && !email) {
      return NextResponse.json({ success: false, error: 'At least one editable field must be provided.' }, { status: 400 });
    }

    // Update in-memory demo store & DB
    const store = getStore();
    const storeCust = store.customers.find((c) => c.id === custId);
    if (storeCust) {
      if (name) storeCust.name = name.trim();
      if (phone) storeCust.phone = phone.trim();
      if (deliveryAddress) storeCust.address = deliveryAddress.trim();
    }

    // Database update
    await query('BEGIN');
    if (deliveryAddress) {
      await query(`UPDATE customer_profiles SET delivery_address = $1, updated_at = NOW() WHERE id = $2`, [deliveryAddress.trim(), custId]);
    }
    if (name || phone || email) {
      const updates: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      if (name) { updates.push(`name = $${idx++}`); params.push(name.trim()); }
      if (phone) { updates.push(`phone = $${idx++}`); params.push(phone.trim()); }
      if (email) { updates.push(`email = $${idx++}`); params.push(email.trim()); }
      params.push(auth.user.userId);

      await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
    }
    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully!',
    });
  } catch (error: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
