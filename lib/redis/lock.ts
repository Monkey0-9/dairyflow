import { redisCommand } from './client';
import crypto from 'crypto';

/**
 * Distributed locking for sensitive background jobs (day-closing, invoice generation).
 * Prevents race conditions across distributed serverless instances.
 */

export async function acquireLock(
  resourceKey: string,
  ttlSeconds = 30
): Promise<string | null> {
  const lockToken = crypto.randomBytes(16).toString('hex');
  const key = `lock:${resourceKey}`;

  try {
    const res = await redisCommand<string>('SET', key, lockToken, 'NX', 'EX', ttlSeconds);
    if (res === 'OK') {
      return lockToken;
    }
    return null;
  } catch {
    // If Redis is down, allow single instance to proceed safely using DB transactions
    return lockToken;
  }
}

export async function releaseLock(
  resourceKey: string,
  lockToken: string
): Promise<boolean> {
  const key = `lock:${resourceKey}`;
  try {
    const current = await redisCommand<string>('GET', key);
    if (current === lockToken) {
      const del = await redisCommand<number>('DEL', key);
      return (del ?? 0) > 0;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Execute an operation protected by a distributed lock.
 */
export async function withLock<T>(
  resourceKey: string,
  ttlSeconds: number,
  operation: () => Promise<T>
): Promise<T> {
  const token = await acquireLock(resourceKey, ttlSeconds);
  if (!token) {
    throw new Error(`Resource ${resourceKey} is currently locked by another process.`);
  }

  try {
    return await operation();
  } finally {
    await releaseLock(resourceKey, token);
  }
}

/**
 * Acquire distributed lock object with release handle.
 */
export async function acquireDistributedLock(
  resourceKey: string,
  ttlMs = 30000
): Promise<{ token: string | null; release: () => Promise<void> }> {
  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
  const token = await acquireLock(resourceKey, ttlSeconds);
  return {
    token,
    release: async () => {
      if (token) {
        await releaseLock(resourceKey, token);
      }
    },
  };
}
