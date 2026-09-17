import { UserRole } from './types';

export interface SessionUser {
  userId: string;
  name: string;
  role: UserRole;
  tenantId: string;
  customerId?: string;
  email?: string;
}

export const SESSION_COOKIE_NAME = 'milkflow_session';

// Safe base64 token encoding for Edge and Node runtimes
export function encodeSession(user: SessionUser): string {
  const json = JSON.stringify(user);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json).toString('base64');
  }
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSession(token?: string): SessionUser | null {
  if (!token) return null;
  try {
    let json = '';
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(token, 'base64').toString('utf-8');
    } else {
      json = decodeURIComponent(escape(atob(token)));
    }
    const parsed = JSON.parse(json);
    if (parsed && parsed.userId && parsed.role) {
      return parsed as SessionUser;
    }
    return null;
  } catch {
    return null;
  }
}

export const PRESET_DEMO_USERS: Record<string, SessionUser> = {
  user_farmer: {
    userId: 'user_farmer',
    name: 'Suresh Patel (Farmer)',
    role: 'FARMER',
    tenantId: 'tenant_greenvalley',
    email: 'suresh@greenvalleydairy.in',
  },
  user_ravi: {
    userId: 'user_ravi',
    name: 'Ravi Kumar',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_ravi',
    email: 'ravi.kumar@gmail.com',
  },
  user_priya: {
    userId: 'user_priya',
    name: 'Priya Sharma',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_priya',
    email: 'priya.sharma@outlook.com',
  },
  user_anand: {
    userId: 'user_anand',
    name: 'Anand Verma',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_anand',
    email: 'anand.verma@gmail.com',
  },
  user_admin: {
    userId: 'user_admin',
    name: 'Platform SuperAdmin',
    role: 'ADMIN',
    tenantId: 'tenant_platform',
    email: 'admin@milkflow.in',
  },
};
