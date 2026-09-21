import { redisCommand } from './client';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Sliding/Fixed window rate limiter for security endpoints (login, password reset, invites).
 * Safe fail-open behavior if Redis is temporarily unreachable.
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests = 10,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;

  try {
    const current = await redisCommand<number>('INCR', key);
    if (current === null) {
      // Redis unavailable: fail open to avoid service outage
      return { allowed: true, remaining: maxRequests, resetSeconds: windowSeconds };
    }

    if (current === 1) {
      await redisCommand('EXPIRE', key, windowSeconds);
    }

    const ttl = (await redisCommand<number>('TTL', key)) ?? windowSeconds;
    const remaining = Math.max(0, maxRequests - current);

    return {
      allowed: current <= maxRequests,
      remaining,
      resetSeconds: Math.max(0, ttl),
    };
  } catch (err) {
    console.error('[Redis RateLimit] Error checking rate limit for identifier:', identifier, err);
    // Fail open (per docstring): callers fall back to the in-memory limiter
    // so a Redis outage never locks users out of authentication.
    return { allowed: true, remaining: maxRequests, resetSeconds: windowSeconds };
  }
}
