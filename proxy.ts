import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Verified HMAC-SHA256 session decoder (Node.js runtime). Unsigned or
// expired tokens are rejected here; login issues signed expiring tokens.
import { decodeSession, SESSION_COOKIE_NAME } from './lib/auth';
import { inspectRequestSecurity, applySecurityHeaders } from './lib/security/firewall';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Run Security Firewall Payload & Rate Inspection
  const securityCheck = inspectRequestSecurity(request);
  if (securityCheck.blocked && securityCheck.response) {
    return applySecurityHeaders(securityCheck.response);
  }

  // Skip static assets, Next internal files, and public images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = decodeSession(sessionCookie);

  // If user is at /login or /register
  if (pathname === '/login' || pathname === '/register') {
    if (session) {
      if (session.role === 'FARMER') {
        return applySecurityHeaders(NextResponse.redirect(new URL('/admin', request.url)));
      } else if (session.role === 'CUSTOMER') {
        return applySecurityHeaders(NextResponse.redirect(new URL('/customer', request.url)));
      } else if (session.role === 'ADMIN') {
        return applySecurityHeaders(NextResponse.redirect(new URL('/superadmin', request.url)));
      }
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // Root route '/'
  if (pathname === '/') {
    if (!session) {
      return applySecurityHeaders(NextResponse.redirect(new URL('/login', request.url)));
    }
    if (session.role === 'FARMER') {
      return applySecurityHeaders(NextResponse.redirect(new URL('/admin', request.url)));
    } else if (session.role === 'CUSTOMER') {
      return applySecurityHeaders(NextResponse.redirect(new URL('/customer', request.url)));
    } else {
      return applySecurityHeaders(NextResponse.redirect(new URL('/superadmin', request.url)));
    }
  }

  // Admin Route Gate (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
    if (session.role === 'CUSTOMER') {
      // Forbidden: Customer trying to access Admin portal -> Redirect to customer portal
      return applySecurityHeaders(NextResponse.redirect(new URL('/customer', request.url)));
    }
  }

  // Customer Route Gate (/customer/*)
  if (pathname.startsWith('/customer')) {
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
    if (session.role === 'FARMER') {
      // Farmer trying to access Customer portal -> Redirect to admin portal
      return applySecurityHeaders(NextResponse.redirect(new URL('/admin', request.url)));
    }
  }

  // SuperAdmin Route Gate (/superadmin/*)
  if (pathname.startsWith('/superadmin')) {
    if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPERADMIN')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return applySecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

