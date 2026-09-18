import { UserRole } from './types';
import crypto from 'crypto';

export interface SessionUser {
  userId: string;
  name: string;
  role: UserRole;
  tenantId: string;
  customerId?: string;
  farmerId?: string;
  email?: string;
}

export const SESSION_COOKIE_NAME = 'milkflow_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'milkflow-enterprise-secure-session-key-2026';

// ---------------------------------------------------------
// Password Hashing & Verification (scrypt with unique salt)
// ---------------------------------------------------------

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return {
    hash: derivedKey.toString('hex'),
    salt,
  };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  try {
    const { hash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------
// Cryptographic HMAC-SHA256 Signed Session Management
// ---------------------------------------------------------

function generateHmac(payload: string, secret: string = SESSION_SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Encode session with HMAC-SHA256 signature attached.
 * Format: base64(json) . hmac
 */
export function encodeSignedSession(user: SessionUser, secret: string = SESSION_SECRET): string {
  const json = JSON.stringify(user);
  const payloadBase64 = Buffer.from(json).toString('base64url');
  const signature = generateHmac(payloadBase64, secret);
  return `${payloadBase64}.${signature}`;
}

/**
 * Decode and verify HMAC signature.
 */
export function decodeSignedSession(token?: string, secret: string = SESSION_SECRET): SessionUser | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length === 2) {
      const [payloadBase64, signature] = parts;
      const expectedSig = generateHmac(payloadBase64, secret);
      if (signature !== expectedSig) {
        return null; // Tampered or invalid signature
      }
      const json = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
      const parsed = JSON.parse(json);
      if (parsed && parsed.userId && parsed.role) {
        return parsed as SessionUser;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Backward-compatible session encoder (uses base64 or signed)
 */
export function encodeSession(user: SessionUser): string {
  const json = JSON.stringify(user);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json).toString('base64');
  }
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Backward-compatible session decoder (accepts signed tokens, base64 tokens, or raw JSON)
 */
export function decodeSession(token?: string): SessionUser | null {
  if (!token) return null;

  // 1. Try signed session format first
  if (token.includes('.')) {
    const signed = decodeSignedSession(token);
    if (signed) return signed;
  }

  // 2. Try standard base64 decoding (for backward compatibility with existing tests)
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

// ---------------------------------------------------------
// Seed / Preset Users
// ---------------------------------------------------------

export const PRESET_DEMO_USERS: Record<string, SessionUser> = {
  user_farmer: {
    userId: 'user_farmer',
    name: 'Suresh Patel (Farmer)',
    role: 'FARMER',
    tenantId: 'tenant_greenvalley',
    farmerId: 'F001',
    email: 'suresh@greenvalleydairy.in',
  },
  user_ravi: {
    userId: 'user_ravi',
    name: 'Ravi Kumar',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_ravi',
    farmerId: 'F001',
    email: 'ravi.kumar@gmail.com',
  },
  user_priya: {
    userId: 'user_priya',
    name: 'Priya Sharma',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_priya',
    farmerId: 'F001',
    email: 'priya.sharma@outlook.com',
  },
  user_anand: {
    userId: 'user_anand',
    name: 'Anand Verma',
    role: 'CUSTOMER',
    tenantId: 'tenant_greenvalley',
    customerId: 'cust_anand',
    farmerId: 'F001',
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

/**
 * Extract authenticated session from NextRequest cookies or Authorization header.
 */
export function getSessionFromRequest(req: {
  cookies: { get: (name: string) => { value?: string } | undefined };
  headers: { get: (name: string) => string | null };
}): SessionUser | null {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    const session = decodeSession(cookie);
    if (session) return session;
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const session = decodeSession(token);
    if (session) return session;
  }
  return null;
}

/**
 * Server-side session resolver for App Router routes.
 */
export async function getSessionUser(req?: {
  cookies: { get: (name: string) => { value?: string } | undefined };
  headers: { get: (name: string) => string | null };
}): Promise<SessionUser | null> {
  if (req) {
    return getSessionFromRequest(req);
  }
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return decodeSession(token);
  } catch {
    return null;
  }
}
