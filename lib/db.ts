// PostgreSQL Database Connection & Query Utilities
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import 'dotenv/config';

// Isolated test runs use a separate database when provided, so live-DB
// suites never accidentally target production (SRS §21).
function requireConnectionString(): string {
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    const errorMessage = '[FATAL CONFIGURATION ERROR] DATABASE_URL is not set in environment variables.';
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMessage);
    } else {
      console.error(errorMessage + ' Application will likely fail if DB operations are attempted.');
    }
    return '';
  }
  return connectionString;
}

// Global pool instance with connection pooling optimized for Neon / Serverless
let pool: Pool | null = null;

const isServerless = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

export function getPool(): Pool {
  if (!pool) {
    // Serverless-safe defaults: small pool, fast recycle. Use the Neon
    // pooled (pooler) connection string in production (see .env.example).
    // Override with PG_POOL_MAX when a dedicated larger pool is provisioned.
    // SSL: Neon requires TLS. `rejectUnauthorized` defaults to false for
    // Neon compatibility (managed certs via pooler) but can be hardened to
    // `true` with `PG_SSL_REJECT_UNAUTHORIZED=true` when the DATABASE_URL
    // uses `sslmode=verify-full` with a verifiable CA chain.
    const max = Number(process.env.PG_POOL_MAX || (isServerless ? 3 : 10));
    const sslOverride = process.env.PG_SSL_REJECT_UNAUTHORIZED;
    const rejectUnauthorized =
      sslOverride === 'true' ? true : sslOverride === 'false' ? false : false;
    // Resolved lazily (not at module load) so `next build` page-data
    // collection can import this module without runtime secrets present.
    // In production the fail-fast throw still fires on first DB use.
    pool = new Pool({
      connectionString: requireConnectionString() || undefined,
      ssl: {
        rejectUnauthorized,
      },
      max: Number.isFinite(max) && max > 0 ? max : 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
      statement_timeout: 15000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client:', err);
    });
  }
  return pool;
}

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  '57P01', // admin shutdown / terminating connection
  '08006', // connection failure
  '08001', // unable to establish sqlconnection
]);

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const errorObj = err as { code?: string; message?: string };
  if (errorObj.code && RETRYABLE_ERROR_CODES.has(errorObj.code)) return true;
  if (errorObj.message && (
    errorObj.message.includes('Connection terminated unexpectedly') ||
    errorObj.message.includes('timeout') ||
    errorObj.message.includes('closed the connection')
  )) {
    return true;
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute a parameterized query against PostgreSQL with automatic exponential backoff retry for transient connection drops.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  maxRetries = 3
): Promise<QueryResult<T>> {
  let attempt = 0;
  while (true) {
    const start = Date.now();
    const currentPool = getPool();
    try {
      const res = await currentPool.query<T>(text, params);
      const duration = Date.now() - start;
      if (process.env.DEBUG_SQL === 'true') {
        console.log('[SQL]', { text, duration, rows: res.rowCount });
      }
      return res;
    } catch (error) {
      attempt++;
      if (attempt <= maxRetries && isRetryable(error)) {
        const backoff = Math.min(200 * Math.pow(2, attempt), 1500) + Math.floor(Math.random() * 50);
        console.warn(`[DB Retry] Query failed with transient error. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }
      console.error('[SQL Error]', { text, error });
      throw error;
    }
  }
}

/**
 * Run operations within a single database transaction with automatic retry on transient connect failure.
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    const currentPool = getPool();
    let client: PoolClient | null = null;
    try {
      client = await currentPool.connect();
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback error if client is dead
        }
      }
      attempt++;
      if (attempt <= maxRetries && isRetryable(error)) {
        const backoff = Math.min(200 * Math.pow(2, attempt), 1500) + Math.floor(Math.random() * 50);
        console.warn(`[DB Retry] Transaction failed with transient error. Retrying attempt ${attempt}/${maxRetries} after ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}

/**
 * Health check utility
 */
export async function testConnection(): Promise<boolean> {
  try {
    const res = await query('SELECT NOW() as current_time');
    return !!res.rows[0]?.current_time;
  } catch (e) {
    console.error('[DB] Health check failed:', e);
    return false;
  }
}
