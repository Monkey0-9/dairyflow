import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, SESSION_COOKIE_NAME, SessionUser } from './auth';
import { query } from './db';
import { UserRole } from './types';

export interface AuthResult {
  user: SessionUser;
  error?: null;
}

export interface AuthError {
  user?: null;
  errorResponse: NextResponse;
}

/**
 * Validates the session cookie from incoming request.
 * Enforces authentication, optional role authorization, and tenant isolation.
 */
export function authenticateRequest(
  req: NextRequest,
  allowedRoles?: UserRole[]
): AuthResult | AuthError {
  // Extract session token from cookies or Authorization header
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const token = cookieToken || authHeader;

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
    };
  }

  const user = decodeSession(token);
  if (!user || !user.userId) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: 'Unauthorized: Invalid or expired session' },
        { status: 401 }
      ),
    };
  }

  // Check role authorization if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user.role;
    // Normalize role comparison (SUPERADMIN has access to ADMIN privileges)
    const hasRole = allowedRoles.some((r) => {
      if (r === userRole) return true;
      if (r === 'ADMIN' && (userRole === 'SUPERADMIN' || userRole === 'ADMIN')) return true;
      return false;
    });

    if (!hasRole) {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: `Forbidden: Access requires one of [${allowedRoles.join(', ')}], current role is ${userRole}`,
          },
          { status: 403 }
        ),
      };
    }
  }

  return { user };
}

/**
 * Enforces that a customer only accesses their own resources.
 */
export function enforceCustomerOwnership(
  user: SessionUser,
  targetCustomerId?: string
): NextResponse | null {
  if (user.role === 'CUSTOMER') {
    if (targetCustomerId && user.customerId && targetCustomerId !== user.customerId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You cannot access data belonging to another customer' },
        { status: 403 }
      );
    }
  }
  return null;
}

/**
 * Enforces tenant isolation.
 */
export function enforceTenantAccess(
  user: SessionUser,
  targetTenantId?: string
): NextResponse | null {
  if (user.role !== 'SUPERADMIN' && targetTenantId && user.tenantId !== targetTenantId) {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Cross-tenant data access is strictly prohibited' },
      { status: 403 }
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Suspended-account enforcement (per-request, best-effort).
// Demo/seed session ids (user_*, cust_*, non-UUID) predate the database and
// are skipped. Results are cached 60s to bound Neon query cost on hot paths.
// Fail-open when the database is unreachable (login enforces strictly).
// ---------------------------------------------------------------------------

const suspendCache = new Map<string, { suspended: boolean; checkedAt: number }>();
const SUSPEND_CACHE_MS = 60000;
const isSeedId = (id?: string): boolean =>
  !id || id.startsWith('user_') || id.startsWith('cust_') || id.startsWith('F') || id.length < 30;

/** Bust the suspend cache (call after tenant/user status mutations). */
export function clearSuspendCache(userId?: string): void {
  if (userId) suspendCache.delete(userId);
  else suspendCache.clear();
}

export async function enforceActiveAccount(user: SessionUser): Promise<NextResponse | null> {
  try {
    if (isSeedId(user.userId)) return null;
    const cached = suspendCache.get(user.userId);
    if (cached && Date.now() - cached.checkedAt < SUSPEND_CACHE_MS) {
      if (!cached.suspended) return null;
    } else {
      const res = await query(
        `SELECT u.is_active as "userActive", t.is_active as "tenantActive"
         FROM users u JOIN tenants t ON u.tenant_id = t.id
         WHERE u.id = $1`,
        [user.userId]
      );
      const row = res.rows[0];
      const suspended = !row || !row.userActive || !row.tenantActive;
      suspendCache.set(user.userId, { suspended, checkedAt: Date.now() });
      if (!suspended) return null;
    }
    return NextResponse.json(
      { success: false, error: 'Forbidden: Account or dairy is suspended.' },
      { status: 403 }
    );
  } catch {
    return null; // fail-open when DB unreachable
  }
}
