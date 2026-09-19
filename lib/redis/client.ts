/**
 * Resilient Redis HTTP REST Client for MilkFlow.
 * Uses Upstash REST protocol over standard HTTP fetch, requiring zero TCP sockets.
 * Gracefully degrades when Redis is unreachable so database transactions are NEVER blocked.
 */

const getRedisConfig = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token, isConfigured: Boolean(url && token) };
};

export interface RedisCommandResult<T = unknown> {
  result: T;
  error?: string;
}

/**
 * Execute a low-level Redis command over REST.
 * Returns null if Redis is unconfigured or unavailable.
 */
export async function redisCommand<T = unknown>(
  command: string,
  ...args: (string | number)[]
): Promise<T | null> {
  const { url, token, isConfigured } = getRedisConfig();
  if (!isConfigured) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s strict timeout

    const body = [command, ...args.map(String)];
    const res = await fetch(`${url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Redis] HTTP error on ${command}: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as RedisCommandResult<T>;
    if (data.error) {
      console.warn(`[Redis] Command error on ${command}: ${data.error}`);
      return null;
    }

    return data.result;
  } catch (err: unknown) {
    // Non-fatal: log warning and continue without breaking the authoritative PostgreSQL flow
    console.warn(`[Redis] Execution error on ${command} (graceful fallback):`, (err as Error).message);
    return null;
  }
}

/**
 * Lightweight Redis health probe for operational monitoring.
 */
export async function pingRedis(): Promise<boolean> {
  const res = await redisCommand<string>('PING');
  return res === 'PONG';
}
