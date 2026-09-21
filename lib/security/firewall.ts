import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, clearAllRateLimits } from './rate-limiter';
import { query } from '../db';

// Clear any stale rate-limit buckets on development reloads
if (process.env.NODE_ENV !== 'production') {
  clearAllRateLimits();
}

/**
 * Enterprise Application Security Firewall (WAF) & Defense-in-Depth Inspection.
 * Protects MilkFlow APIs against SQL Injection, XSS payloads, brute force, and header tampering.
 */

// Common high-risk malicious patterns in web request parameters or headers
const MALICIOUS_PATTERNS = [
  // WARNING: Regex-based input validation is not a complete defense against SQLi/XSS.
  // Always use parameterized queries for SQL and proper output encoding for HTML.
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC|EXECUTE)\b\s+.*\b(FROM|INTO|TABLE|DATABASE)\b)/i,
  /--\s*$/m,
  /\bOR\s+1\s*=\s*1\b/i,
  /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
  /javascript\s*:/i,
  /\bonerror\s*=/i,
  /\bonload\s*=/i,
];

export interface FirewallCheckResult {
  blocked: boolean;
  reason?: string;
  response?: NextResponse;
}

/**
 * Inspect incoming NextRequest against security firewall policies.
 */
export function inspectRequestSecurity(req: NextRequest): FirewallCheckResult {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
  const pathname = req.nextUrl.pathname;

  // 1. Endpoint Rate Limiting Throttling (only applies to API routes)
  const isApiRoute = pathname.startsWith('/api/');
  const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === 'anonymous_ip';
  const isDevOrTest = process.env.NODE_ENV !== 'production' || process.env.PLAYWRIGHT === 'true' || process.env.VITEST === 'true';

  if (isApiRoute) {
    // Ultra-generous limit (10,000 reqs/min) for local development/loopback, strict for public IPs
    let maxReqs = isLoopback || isDevOrTest ? 10000 : 300;
    if (pathname.includes('/auth/login') || pathname.includes('/auth/activate-customer')) {
      if (process.env.NODE_ENV === 'production') {
        maxReqs = isLoopback ? 2000 : 30;
      } else {
        maxReqs = isLoopback || isDevOrTest ? 2000 : 30;
      }
    }

    const rateCheck = checkRateLimit(`waf_${ip}_${pathname}`, maxReqs, 60);
    if (!rateCheck.allowed) {
      logSuspiciousEvent(ip, pathname, 'RATE_LIMIT_EXCEEDED', `Exceeded limit of ${maxReqs} requests/min`);
      return {
        blocked: true,
        reason: 'Rate limit exceeded',
        response: NextResponse.json(
          { success: false, error: 'Security Firewall: Request rate limit exceeded. Please try again later.' },
          { status: 429, headers: { 'Retry-After': String(rateCheck.resetTimeSeconds) } }
        ),
      };
    }
  }

  // 2. Query String Payload Inspection
  const queryString = req.nextUrl.search;
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(queryString)) {
      logSuspiciousEvent(ip, pathname, 'MALICIOUS_QUERY_PAYLOAD', queryString);
      return {
        blocked: true,
        reason: 'Malicious query string detected',
        response: NextResponse.json(
          { success: false, error: 'Security Firewall: Suspicious or malformed payload detected.' },
          { status: 400 }
        ),
      };
    }
  }

  return { blocked: false };
}

/**
 * Apply Enterprise HTTP Security Headers onto Next.js Response.
 */
export function applySecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:;"
  );
  return res;
}

/**
 * Audit log security violations asynchronously without blocking response thread.
 */
function logSuspiciousEvent(ip: string, path: string, eventType: string, details: string): void {
  try {
    console.warn(`[SECURITY FIREWALL WARN] ${eventType} from IP=${ip} Path=${path}: ${details}`);
    query(
      `INSERT INTO activity_events (id, tenant_id, actor_id, actor_role, action, description, metadata, created_at)
      VALUES (gen_random_uuid(), 'tenant_greenvalley', 'system_firewall', 'FIREWALL', $1, $2, $3, NOW())`,
      [eventType, `Security event at ${path} from ${ip}`, JSON.stringify({ ip, path, details })]
    ).catch(() => {});
  } catch {
    // Fail silently to avoid breaking caller flow
  }
}
