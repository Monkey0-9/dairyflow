import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query, transaction } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Sign in required.' }, { status: 401 });
    }

    if (session.role !== 'FARMER' && session.role !== 'ADMIN' && session.role !== 'OWNER' && session.role !== 'SUPERADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    // Query PostgreSQL for Farmer/Admin Profile
    const res = await query<{
      userId: string;
      farmerId: string | null;
      tenantId: string;
      name: string;
      email: string;
      phone: string;
      role: string;
      businessName: string | null;
      upiId: string | null;
      address: string | null;
      routeCode: string | null;
      tenantName: string;
    }>(
      `SELECT u.id as "userId", f.id as "farmerId", u.tenant_id as "tenantId",
              u.name, u.email, u.phone, u.role,
              f.business_name as "businessName", f.upi_id as "upiId",
              f.address, f.route_code as "routeCode",
              t.name as "tenantName"
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       LEFT JOIN farmer_profiles f ON f.user_id = u.id
       WHERE u.id = $1`,
      [session.userId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Profile not found.' }, { status: 404 });
    }

    const row = res.rows[0];

    return NextResponse.json({
      success: true,
      profile: {
        userId: row.userId,
        farmerId: row.farmerId,
        tenantId: row.tenantId,
        name: row.name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        businessName: row.businessName || row.tenantName || 'Dairy Enterprise',
        upiId: row.upiId || 'dairy@okaxis',
        address: row.address || 'Dairy Headquarters',
        routeCode: row.routeCode || 'ROUTE-1',
        currency: 'INR (₹)',
        timezone: 'Asia/Kolkata (IST +05:30)',
        activeSessions: [
          {
            id: 'sess_current',
            device: 'Current Web Session',
            ip: '127.0.0.1',
            lastActive: 'Just now',
            isCurrent: true,
          },
        ],
        notifications: {
          sms: true,
          whatsapp: true,
          email: true,
          inApp: true,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error fetching profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Sign in required.' }, { status: 401 });
    }

    if (session.role !== 'FARMER' && session.role !== 'ADMIN' && session.role !== 'OWNER' && session.role !== 'SUPERADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden: Admin access required.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, businessName, upiId, address } = body;

    await transaction(async (client) => {
      // 1. Update User basic info
      if (name || phone) {
        await client.query(
          `UPDATE users
           SET name = COALESCE($1, name),
               phone = COALESCE($2, phone),
               updated_at = NOW()
           WHERE id = $3`,
          [name ? name.trim() : null, phone ? phone.trim() : null, session.userId]
        );
      }

      // 2. Upsert Farmer Profile info
      const checkFarmer = await client.query<{ id: string }>(
        `SELECT id FROM farmer_profiles WHERE user_id = $1`,
        [session.userId]
      );

      if (checkFarmer.rows.length > 0) {
        await client.query(
          `UPDATE farmer_profiles
           SET business_name = COALESCE($1, business_name),
               upi_id = COALESCE($2, upi_id),
               address = COALESCE($3, address),
               updated_at = NOW()
           WHERE user_id = $4`,
          [
            businessName ? businessName.trim() : null,
            upiId ? upiId.trim() : null,
            address ? address.trim() : null,
            session.userId,
          ]
        );
      } else {
        const newFarmerId = `farmer_${Date.now()}`;
        await client.query(
          `INSERT INTO farmer_profiles (id, user_id, tenant_id, business_name, upi_id, address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            newFarmerId,
            session.userId,
            session.tenantId,
            businessName ? businessName.trim() : 'GreenValley Dairy',
            upiId ? upiId.trim() : 'dairy@okaxis',
            address ? address.trim() : 'Main Dairy Route',
          ]
        );
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Admin profile successfully updated in PostgreSQL database.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
