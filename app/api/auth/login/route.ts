import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { encodeSignedSession, verifyPassword, CLIENT_HINT_COOKIE_NAME, formatClientHint, PRESET_DEMO_USERS, SESSION_COOKIE_NAME, SessionUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { query } from '@/lib/db';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';
const demoLoginEnabled = () => process.env.DEMO_LOGIN_ENABLED !== 'false';

interface DbLoginRow {
  userId: string;
  name: string;
  role: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  userActive: boolean;
  tenantActive: boolean;
  customerId: string | null;
  farmerDbId: string | null;
}

/**
 * Production credential check against PostgreSQL.
 * Enforces scrypt password verification + user/tenant active flags
 * (tenant suspension blocks login). Returns null when DB is unreachable
 * so callers can fall back to demo/store flows.
 */
async function verifyDbCredentials(phone: string, password?: string): Promise<{ user: SessionUser } | { error: string; status: number } | null> {
  try {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 10) return null;
    const res = await query<DbLoginRow>(
      `SELECT u.id as "userId", u.name, u.role, u.tenant_id as "tenantId", u.email,
              u.password_hash as "passwordHash", u.password_salt as "passwordSalt",
              u.is_active as "userActive", t.is_active as "tenantActive",
              c.id as "customerId", f.id as "farmerDbId"
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       LEFT JOIN customer_profiles c ON c.user_id = u.id
       LEFT JOIN farmer_profiles f ON f.user_id = u.id
       WHERE regexp_replace(u.phone, '[^0-9]', '', 'g') LIKE '%' || $1
       ORDER BY u.created_at ASC
       LIMIT 5`,
      [digits.slice(-10)]
    );
    if (res.rows.length === 0) return null;
    // Prefer exact digit-suffix match already done by LIKE on last-10; take first.
    const row = res.rows[0];
    if (!row.userActive) return { error: 'Account is deactivated. Please contact your dairy.', status: 403 };
    if (!row.tenantActive) return { error: 'Dairy account is suspended. Please contact platform support.', status: 403 };
    if (!password || !verifyPassword(password, row.passwordHash, row.passwordSalt)) {
      return { error: 'Invalid phone number or password.', status: 401 };
    }
    return {
      user: {
        userId: row.userId,
        name: row.name,
        role: row.role as SessionUser['role'],
        tenantId: row.tenantId,
        customerId: row.customerId || undefined,
        farmerId: row.farmerDbId || undefined,
        email: row.email,
      },
    };
  } catch {
    return null; // DB unreachable -> caller falls back
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting: 20 login attempts per IP per minute
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
  const limitCheck = checkRateLimit(`login_${ip}`, 20, 60);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limitCheck.resetTimeSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const { demoUserId, phone, password } = body;
    const store = getStore();

    let sessionUser: SessionUser | null = null;

    if (demoUserId) {
      if (!demoLoginEnabled()) {
        return NextResponse.json(
          { success: false, error: 'Demo login is disabled in this environment.' },
          { status: 403 }
        );
      }
      // 1-tap quick persona switcher login
      if (PRESET_DEMO_USERS[demoUserId]) {
        sessionUser = PRESET_DEMO_USERS[demoUserId];
      } else {
        // Find in store
        const user = store.users.find((u) => u.id === demoUserId);
        const cust = store.customers.find((c) => c.userId === demoUserId);
        if (user) {
          sessionUser = {
            userId: user.id,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            customerId: cust?.id,
            email: user.email,
          };
        }
      }
    } else if (phone) {
      // 1) Production DB credential verification (password + active flags enforced)
      if (!isUnitTest()) {
        const dbResult = await verifyDbCredentials(phone.trim(), password);
        if (dbResult && 'error' in dbResult) {
          return NextResponse.json({ success: false, error: dbResult.error }, { status: dbResult.status });
        }
        if (dbResult && 'user' in dbResult) {
          sessionUser = dbResult.user;
        }
      }
      // 2) Demo/store fallback (dev, tests, or DB unreachable)
      if (!sessionUser) {
        const cleanPhone = phone.trim();
        const user = store.users.find(
          (u) => u.phone.includes(cleanPhone) || u.phone.replace(/[^0-9]/g, '').includes(cleanPhone)
        );

        if (user) {
          const cust = store.customers.find((c) => c.userId === user.id);
          sessionUser = {
            userId: user.id,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            customerId: cust?.id,
            email: user.email,
          };
        } else {
          return NextResponse.json(
            { success: false, error: 'No account found with this phone number. Please register first.' },
            { status: 401 }
          );
        }
      }
    }

    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid login credentials or persona' },
        { status: 400 }
      );
    }

    let redirectUrl = '/admin';
    if (sessionUser.role === 'CUSTOMER') {
      redirectUrl = '/customer';
    } else if (sessionUser.role === 'ADMIN') {
      redirectUrl = '/superadmin';
    }

    const token = encodeSignedSession(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      redirectUrl,
    });

    const isProd = process.env.NODE_ENV === 'production';

    // 1. Primary authenticated session cookie (strictly HttpOnly, protected from XSS)
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      path: '/',
      httpOnly: true,
      secure: isProd,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    });

    // 2. Client-readable hint cookie (non-sensitive: name, role, tenantId only)
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
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
