import { redisCommand } from './client';

/**
 * Cache module for expensive dashboard aggregates and read-heavy operations.
 * If Redis is down, all operations gracefully bypass cache and query PostgreSQL directly.
 */

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisCommand<string>('GET', key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, value: T, ttlSeconds = 60): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);
    const res = await redisCommand<string>('SET', key, serialized, 'EX', ttlSeconds);
    return res === 'OK';
  } catch {
    return false;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  try {
    const res = await redisCommand<number>('DEL', key);
    return (res ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Read-through caching wrapper.
 * Checks cache first; on miss or Redis failure, executes DB fetcher, saves to cache asynchronously, and returns real DB data.
 */
export async function cachedQuery<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Authoritative PostgreSQL fetch
  const freshData = await fetcher();

  // Async non-blocking cache population
  setCache(key, freshData, ttlSeconds).catch(() => {});

  return freshData;
}
