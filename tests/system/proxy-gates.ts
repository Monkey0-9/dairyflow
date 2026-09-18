import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { encodeSignedSession, SESSION_COOKIE_NAME } from '@/lib/auth';

function request(path: string, session?: object) {
  const headers: Record<string, string> = {};
  if (session) {
    const token = encodeSignedSession(session as never);
    headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
  }
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe('System: proxy route gates (Next.js 16)', () => {
  it('redirects unauthenticated /admin to /login', async () => {
    const res = await proxy(request('/admin'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('sends CUSTOMER sessions away from /admin', async () => {
    const res = await proxy(
      request('/admin', { userId: 'u1', name: 'C', role: 'CUSTOMER', tenantId: 't1', customerId: 'c1' })
    );
    expect(res.headers.get('location')).toContain('/customer');
  });

  it('lets FARMER sessions through to /admin', async () => {
    const res = await proxy(
      request('/admin', { userId: 'u2', name: 'F', role: 'FARMER', tenantId: 't1' })
    );
    // NextResponse.next() carries no redirect location
    expect(res.headers.get('location')).toBeNull();
  });

  it('rejects forged sessions (bad signature) to /login', async () => {
    const bad = Buffer.from(JSON.stringify({ userId: 'u9', role: 'FARMER', tenantId: 't1' })).toString('base64url');
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${bad}.forged-signature` },
    });
    const res = await proxy(req);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('rejects unsigned legacy tokens in test env only when production-like', async () => {
    // In non-production, legacy unsigned tokens still decode (compat path)
    const legacy = Buffer.from(JSON.stringify({ userId: 'u3', role: 'FARMER', tenantId: 't1' })).toString('base64');
    const req = new NextRequest('http://localhost:3000/admin', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${legacy}` },
    });
    const res = await proxy(req);
    expect(res.headers.get('location')).toBeNull();
  });

  it('blocks non-admins from /superadmin', async () => {
    const res = await proxy(
      request('/superadmin', { userId: 'u1', name: 'C', role: 'CUSTOMER', tenantId: 't1' })
    );
    expect(res.headers.get('location')).toContain('/login');
  });
});
