import crypto from 'crypto';

/**
 * Generate a cryptographically secure random invitation token.
 */
export function generateRawInvitationToken(): string {
  return crypto.randomBytes(24).toString('hex'); // 48-char opaque token
}

/**
 * Hash invitation token with SHA-256 before saving to PostgreSQL.
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Constant-time verification of raw invitation token against stored SHA-256 hash.
 */
export function verifyInvitationToken(rawToken: string, storedHash: string): boolean {
  try {
    const computedHash = hashInvitationToken(rawToken);
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch {
    return false;
  }
}
