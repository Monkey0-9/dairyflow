import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword, encodeSignedSession, SESSION_COOKIE_NAME, CLIENT_HINT_COOKIE_NAME, formatClientHint, SessionUser } from '@/lib/auth';
import { hashInvitationToken } from '@/lib/security/invitation-crypto';
import { checkRateLimit } from '@/lib/security/rate-limiter';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
  const limitCheck = checkRateLimit(`activate_${ip}`, 10, 60);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many activation attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const { token, password } = await req.json();
    if (!token || !password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Valid invitation token and a password (min 6 chars) are required.' },
        { status: 400 }
      );
    }

    const tokenHash = hashInvitationToken(token.trim());

    // Fetch invitation from database
    const invRes = await query(
      `SELECT id, customer_id as "customerId", expires_at as "expiresAt", used_at as "usedAt", revoked_at as "revokedAt"
      FROM customer_invitations
      WHERE token_hash = $1`,
      [tokenHash]
    );

    const inv = invRes.rows[0];
    if (!inv) {
      return NextResponse.json({ success: false, error: 'Invalid or expired invitation token.' }, { status: 404 });
    }

    if (inv.usedAt) {
      return NextResponse.json({ success: false, error: 'This invitation link has already been used.' }, { status: 400 });
    }

    if (inv.revokedAt) {
      return NextResponse.json({ success: false, error: 'This invitation has been revoked by the administrator.' }, { status: 400 });
    }

    if (new Date(inv.expiresAt) < new Date()) {
      return NextResponse.json({ success: false, error: 'This invitation token has expired.' }, { status: 400 });
    }

    // Fetch customer profile & user record
    const custRes = await query(
      `SELECT c.id as "customerId", c.user_id as "userId", c.tenant_id as "tenantId", c.farmer_id as "farmerId", u.name, u.email
       FROM customer_profiles c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [inv.customerId]
    );

    const cust = custRes.rows[0];
    if (!cust) {
      return NextResponse.json({ success: false, error: 'Associated customer profile not found.' }, { status: 404 });
    }

    const { hash, salt } = hashPassword(password);

    // Transactionally activate customer, set password, mark invitation as used
    await query('BEGIN');
    await query(
      `UPDATE users SET password_hash = $1, password_salt = $2, is_active = true, updated_at = NOW() WHERE id = $3`,
      [hash, salt, cust.userId]
    );
    await query(
      `UPDATE customer_profiles SET is_active = true, updated_at = NOW() WHERE id = $1`,
      [cust.customerId]
    );
    await query(
      `UPDATE customer_invitations SET used_at = NOW() WHERE id = $1`,
      [inv.id]
    );
    await query('COMMIT');

    const sessionUser: SessionUser = {
      userId: cust.userId,
      name: cust.name,
      role: 'CUSTOMER',
      tenantId: cust.tenantId,
      customerId: cust.customerId,
      farmerId: cust.farmerId,
      email: cust.email,
    };

    const sessionToken = encodeSignedSession(sessionUser);
    const isProd = process.env.NODE_ENV === 'production';

    const response = NextResponse.json({
      success: true,
      message: 'Account activated successfully!',
      user: sessionUser,
      redirectUrl: '/customer',
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      path: '/',
      httpOnly: true,
      secure: isProd,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    response.cookies.set({
      name: CLIENT_HINT_COOKIE_NAME,
      value: formatClientHint(sessionUser),
      path: '/',
      httpOnly: false,
      secure: isProd,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (error: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = error instanceof Error ? error.message : 'Activation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
