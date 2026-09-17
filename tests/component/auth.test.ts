import { describe, it, expect } from 'vitest';
import { encodeSession, decodeSession, PRESET_DEMO_USERS, SessionUser } from '@/lib/auth';

describe('Component Testing: Authentication & Session Token Handler', () => {
  const sampleUser: SessionUser = {
    userId: 'user_farmer',
    name: 'Suresh Patel',
    role: 'FARMER',
    tenantId: 'tenant_greenvalley',
    email: 'suresh@greenvalley.in',
  };

  it('should encode and decode a session user with 100% fidelity', () => {
    const token = encodeSession(sampleUser);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);

    const decoded = decodeSession(token);
    expect(decoded).toEqual(sampleUser);
  });

  it('should encode and decode a customer session with customerId', () => {
    const customerUser: SessionUser = {
      userId: 'user_ravi',
      name: 'Ravi Kumar',
      role: 'CUSTOMER',
      tenantId: 'tenant_greenvalley',
      customerId: 'cust_ravi',
    };

    const token = encodeSession(customerUser);
    const decoded = decodeSession(token);
    expect(decoded?.customerId).toBe('cust_ravi');
    expect(decoded?.role).toBe('CUSTOMER');
  });

  it('should safely return null for missing, empty, or undefined tokens', () => {
    expect(decodeSession(undefined)).toBeNull();
    expect(decodeSession('')).toBeNull();
  });

  it('should safely return null for invalid base64 or non-JSON strings without throwing', () => {
    expect(decodeSession('not-a-valid-token-!!!')).toBeNull();
    expect(decodeSession('SGVsbG8gV29ybGQ=')).toBeNull(); // "Hello World" is not JSON
  });

  it('should return null if decoded JSON lacks required auth properties (userId or role)', () => {
    const invalidPayload = Buffer.from(JSON.stringify({ someKey: 'no_user_id' })).toString('base64');
    expect(decodeSession(invalidPayload)).toBeNull();
  });

  it('should contain valid preset demo users for all primary personas', () => {
    expect(PRESET_DEMO_USERS.user_farmer.role).toBe('FARMER');
    expect(PRESET_DEMO_USERS.user_ravi.role).toBe('CUSTOMER');
    expect(PRESET_DEMO_USERS.user_admin.role).toBe('ADMIN');
  });
});
