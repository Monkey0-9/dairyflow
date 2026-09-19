import { describe, it, expect } from 'vitest';
import { POST as registerPost } from '@/app/api/auth/register/route';
import { PUT as updateProfilePut } from '@/app/api/customer/profile/route';
import { generateRawInvitationToken, hashInvitationToken, verifyInvitationToken } from '@/lib/security/invitation-crypto';
import { inspectRequestSecurity, applySecurityHeaders } from '@/lib/security/firewall';
import { encodeSignedSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

describe('Phase A & Security Audit: Firewall, Invitation Hashing & Profile Self-Editing', () => {
  it('strictly rejects public customer self-registration with HTTP 403 Forbidden', async () => {
    const res = await registerPost();
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(json.error).toContain('Forbidden');
  });

  it('hashes invitation tokens with SHA-256 and verifies constant-time matching', () => {
    const rawToken = generateRawInvitationToken();
    expect(rawToken).toHaveLength(48);

    const hash = hashInvitationToken(rawToken);
    expect(hash).toHaveLength(64);

    const isMatched = verifyInvitationToken(rawToken, hash);
    expect(isMatched).toBe(true);

    const isTampered = verifyInvitationToken('invalid_token_12345', hash);
    expect(isTampered).toBe(false);
  });

  it('allows customer to edit personal details but rejects immutability violations (farmerId/tenantId/dailyQuantity)', async () => {
    const sessionToken = encodeSignedSession({
      userId: 'user_ravi',
      name: 'Ravi Kumar',
      role: 'CUSTOMER',
      tenantId: 'tenant_greenvalley',
      customerId: 'cust_ravi',
    });

    // 1. Attempt malicious modification of farmerId
    const reqMalicious = new NextRequest('http://localhost:3000/api/customer/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        farmerId: 'F002', // FORBIDDEN MUTATION!
        name: 'Ravi Updated',
      }),
    });

    const resMalicious = await updateProfilePut(reqMalicious);
    const jsonMalicious = await resMalicious.json();

    expect(resMalicious.status).toBe(403);
    expect(jsonMalicious.success).toBe(false);
    expect(jsonMalicious.error).toContain('Forbidden');

    // 2. Legal edit of personal address and phone
    const reqLegal = new NextRequest('http://localhost:3000/api/customer/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
      },
      body: JSON.stringify({
        name: 'Ravi Kumar Updated',
        phone: '+91 98765 00000',
        deliveryAddress: 'Flat 402, Green Towers, City',
      }),
    });

    const resLegal = await updateProfilePut(reqLegal);
    const jsonLegal = await resLegal.json();

    expect(resLegal.status).toBe(200);
    expect(jsonLegal.success).toBe(true);
  });

  it('applies Security Firewall headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options)', () => {
    const res = NextResponse.next();
    const secured = applySecurityHeaders(res);

    expect(secured.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(secured.headers.get('X-Frame-Options')).toBe('DENY');
    expect(secured.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(secured.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('detects and blocks malicious query payload injection attempts', () => {
    const reqSqli = new NextRequest('http://localhost:3000/api/customers?id=1%27%20UNION%20SELECT%20*%20FROM%20users--');
    const result = inspectRequestSecurity(reqSqli);

    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('Malicious query string detected');
  });
});
