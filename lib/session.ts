import { UserRole } from './types';

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

/**
 * Edge-compatible session encoder (uses base64 standard)
 */
export function encodeSession(user: SessionUser): string {
  const json = JSON.stringify(user);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json).toString('base64');
  }
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Edge-compatible session decoder (accepts signed tokens, base64 tokens, or raw JSON)
 */
export function decodeSession(token?: string): SessionUser | null {
  if (!token) return null;

  try {
    let payloadStr = token;
    // If token is signed format (payload.signature), extract payload
    if (token.includes('.')) {
      payloadStr = token.split('.')[0];
    }

    let json = '';
    if (typeof Buffer !== 'undefined') {
      try {
        json = Buffer.from(payloadStr, 'base64url').toString('utf-8');
      } catch {
        json = Buffer.from(payloadStr, 'base64').toString('utf-8');
      }
    } else {
      json = decodeURIComponent(escape(atob(payloadStr)));
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
