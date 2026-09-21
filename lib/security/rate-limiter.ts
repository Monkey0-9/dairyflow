/**
 * In-Memory Sliding Window Rate Limiter for API Endpoints.
 * Enforces request throttling to protect against brute force and DoS attacks.
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const cache = new Map<string, RateLimitBucket>();
let rateLimitCleanupIntervalId: NodeJS.Timeout | undefined;

// Periodic cleanup of stale buckets every 5 minutes
if (typeof setInterval !== 'undefined') {
  rateLimitCleanupIntervalId = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of cache.entries()) {
      if (bucket.resetAt <= now) {
        cache.delete(key);
      }
    }
  }, 300000);
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTimeSeconds: number;
}

/**
 * Check and increment request count for a given identifier.
 * @param key Unique identifier (IP address, user ID, or combined route+IP)
 * @param maxRequests Maximum allowed requests within the window (e.g. 60)
 * @param windowSeconds Window size in seconds (default 60)
 */
export function checkRateLimit(
  key: string,
  maxRequests = 60,
  windowSeconds = 60
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let bucket = cache.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    cache.set(key, bucket);
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTimeSeconds: Math.ceil(windowMs / 1000),
    };
  }

  bucket.count += 1;
  const remaining = Math.max(0, maxRequests - bucket.count);
  const resetTimeSeconds = Math.ceil((bucket.resetAt - now) / 1000);

  if (bucket.count > maxRequests) {
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetTimeSeconds,
    };
  }

  return {
    allowed: true,
    limit: maxRequests,
    remaining,
    resetTimeSeconds,
  };
}

/**
 * Reset limit for a key (useful for tests or after successful captcha).
 */
export function resetRateLimit(key: string): void {
  cache.delete(key);
}

/**
 * Clear all rate-limit buckets from memory immediately.
 */
export function clearAllRateLimits(): void {
  cache.clear();
}

/**
 * Stops the periodic cleanup of stale rate limit buckets.
 * This should be called if the module is being unloaded or if the application
 * is shutting down to prevent resource leaks, especially in environments
 * where modules might be dynamically reloaded (e.g., hot module replacement)
 * or in serverless functions that might stay warm.
 */
export function stopRateLimiterCleanup(): void {
  if (typeof clearInterval !== 'undefined' && rateLimitCleanupIntervalId) {
    clearInterval(rateLimitCleanupIntervalId);
    rateLimitCleanupIntervalId = undefined; // Clear the reference
  }
}
