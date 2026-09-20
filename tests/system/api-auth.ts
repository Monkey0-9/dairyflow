import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { SESSION_COOKIE_NAME, encodeSession } from '@/lib/auth';
import { resetTestStore } from '../setup';

describe('System Testing: Authentication API Endpoints', () => {
  beforeEach(() => {
    resetTestStore();
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate demo farmer and set session cookie', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          demoUserId: 'user_farmer',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('FARMER');
      expect(data.user.name).toContain('Suresh');

      // Check cookie header
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain(SESSION_COOKIE_NAME);
    });

    it('should authenticate demo customer and return customerId', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '+91 98234 56780',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('CUSTOMER');
      expect(data.user.customerId).toBe('cust_ravi');
    });

    it('should reject invalid credentials with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '9999999999',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid login credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 when no session cookie is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
      });

      const res = await meHandler(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should return user session when valid cookie is provided', async () => {
      const token = encodeSession({
        userId: 'user_farmer',
        name: 'Suresh Patel (Farmer)',
        role: 'FARMER',
        tenantId: 'tenant_greenvalley',
        email: 'suresh@greenvalleydairy.in',
      });

      const req = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await meHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('FARMER');
      expect(data.user.userId).toBe('user_farmer');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear session cookie on logout', async () => {
      const res = await logoutHandler();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain('Expires=Thu, 01 Jan 1970');
    });
  });
});
