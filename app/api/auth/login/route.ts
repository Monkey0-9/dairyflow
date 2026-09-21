import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import {
  encodeSignedSession,
  verifyPassword,
  CLIENT_HINT_COOKIE_NAME,
  formatClientHint,
  PRESET_DEMO_USERS,
  SESSION_COOKIE_NAME,
  SessionUser,
} from '@/lib/auth';
import { checkRateLimit as checkMemoryRateLimit } from '@/lib/security/rate-limiter';
import { checkRateLimit as checkSharedRateLimit } from '@/lib/redis/rate-limit';
import { query } from '@/lib/db';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';
// SRS §21: demo/persona authentication exists ONLY as an isolated unit-test
// fixture. Production and development runtimes authenticate against
// PostgreSQL with real credentials — no demo fallback, no mock users.
const demoLoginEnabled = () => isUnitTest();

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
 * (pending users receive explicit admin approval instructions).
 */
async function verifyDbCredentials(
  identifier: string,
  password?: string
): Promise<{ user: SessionUser } | { error: string; status: number } | null> {
  try {
    const isEmail = identifier.includes('@');
    let res;
    if (isEmail) {
      res = await query<DbLoginRow>(
        `SELECT u.id as "userId", u.name, u.role, u.tenant_id as "tenantId", u.email,
                u.password_hash as "passwordHash", u.password_salt as "passwordSalt",
                u.is_active as "userActive", t.is_active as "tenantActive",
                c.id as "customerId", f.id as "farmerDbId"
         FROM users u
         JOIN tenants t ON u.tenant_id = t.id
         LEFT JOIN customer_profiles c ON c.user_id = u.id
         LEFT JOIN farmer_profiles f ON f.user_id = u.id
         WHERE LOWER(u.email) = LOWER($1)
         ORDER BY u.created_at ASC
         LIMIT 5`,
        [identifier.trim().toLowerCase()]
      );
    } else {
      const digits = identifier.replace(/[^0-9]/g, '');
      if (digits.length < 10) return null;
      res = await query<DbLoginRow>(
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
    }

    if (res.rows.length === 0) {
      // FR-AUTH-002: generic failure — do not reveal account existence.
      return { error: 'Invalid login credentials. Please check and try again.', status: 401 };
    }
    const row = res.rows[0];

    // Password verification
    if (!password || !verifyPassword(password, row.passwordHash, row.passwordSalt)) {
      return { error: 'Invalid login credentials. Please check and try again.', status: 401 };
    }

    // Gatekeeper: Inactive / Pending Account
    if (!row.userActive) {
      return {
        error:
          'Your registration is pending approval by Prakash Paraveen (Admin). Once accepted, your account will be activated and you will be able to sign in.',
        status: 403,
      };
    }

    if (!row.tenantActive) {
      return { error: 'Dairy account is suspended. Please contact platform support.', status: 403 };
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
  } catch (dbErr: unknown) {
    console.error('[verifyDbCredentials] Database connection error:', dbErr);
    return { error: 'Database service is temporarily unavailable. Please try again later.', status: 503 };
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting: 50 login attempts per IP per minute (relaxed on loopback for automated testing)
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
  const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === 'anonymous_ip';
  const isTest = isUnitTest() || process.env.PLAYWRIGHT === 'true' || process.env.CI === 'true';
  // SRS §21: shared Redis limiter when configured (multi-instance safe),
  // resilient in-memory fallback otherwise. Redis outage fails open.
  const useSharedLimiter = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  let limitCheck = { allowed: true, resetTimeSeconds: 0 };
  if (!(isTest && isLoopback)) {
    if (useSharedLimiter) {
      const shared = await checkSharedRateLimit(`login_${ip}`, 50, 60);
      limitCheck = { allowed: shared.allowed, resetTimeSeconds: shared.resetSeconds };
    } else {
      limitCheck = checkMemoryRateLimit(`login_${ip}`, 50, 60);
    }
  }
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many login attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limitCheck.resetTimeSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const { demoUserId, phone, email, identifier, userIdentifier: rawUserIdentifier, password } = body;
    const userIdentifier = (identifier || rawUserIdentifier || phone || email || '').trim();
    const store = getStore();

    let sessionUser: SessionUser | null = null;

    if (demoUserId) {
      // Removed from all runtimes except isolated unit tests (SRS §21).
      if (!demoLoginEnabled() || !PRESET_DEMO_USERS[demoUserId]) {
        return NextResponse.json(
          { success: false, error: 'Demo persona login is disabled in this environment. Please sign in with real credentials.' },
          { status: 403 }
        );
      }
      sessionUser = PRESET_DEMO_USERS[demoUserId];
    } else if (userIdentifier) {
      // 1) Production DB credential verification (password + active flags enforced)
      if (!isUnitTest()) {
        const dbResult = await verifyDbCredentials(userIdentifier, password);
        if (dbResult && 'error' in dbResult) {
          return NextResponse.json({ success: false, error: dbResult.error }, { status: dbResult.status });
        }
        if (dbResult && 'user' in dbResult) {
          sessionUser = dbResult.user;
        }
      }

      // 2) Store fallback (strictly isolated to unit tests without live database)
      if (!sessionUser) {
        if (!isUnitTest()) {
          return NextResponse.json(
            { success: false, error: 'Database service is temporarily unavailable or credentials invalid.' },
            { status: 503 }
          );
        }

        const cleanIdent = userIdentifier.toLowerCase();
        const digits = userIdentifier.replace(/[^0-9]/g, '');
        const user = store.users.find(
          (u) =>
            (u.email && u.email.toLowerCase() === cleanIdent) ||
            (digits.length >= 10 && u.phone && u.phone.replace(/[^0-9]/g, '').includes(digits))
        );

        if (user) {
          const cust = store.customers.find((c) => c.userId === user.id);
          if (cust && (cust.accountStatus === 'PENDING' || !cust.active)) {
            return NextResponse.json(
              {
                success: false,
                error:
                  'Your registration is pending approval by Prakash Paraveen (Admin). Once accepted, your account will be activated and you will be able to sign in.',
              },
              { status: 403 }
            );
          }

          sessionUser = {
            userId: user.id,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            customerId: cust?.id,
            email: user.email,
          };
        } else {
          // FR-AUTH-002: same generic message as DB path.
          return NextResponse.json(
            { success: false, error: 'Invalid login credentials. Please check and try again.' },
            { status: 401 }
          );
        }
      }
    }

    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid login credentials. Please provide valid email/phone and password.' },
        { status: 400 }
      );
    }

    let redirectUrl = '/admin';
    if (sessionUser.role === 'CUSTOMER') {
      redirectUrl = '/customer';
    } else if (sessionUser.role === 'ADMIN' || sessionUser.role === 'SUPERADMIN') {
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
