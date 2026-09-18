import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, SESSION_COOKIE_NAME, SessionUser } from './auth';
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
