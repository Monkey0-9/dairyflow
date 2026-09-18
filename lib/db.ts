// PostgreSQL Database Connection & Query Utilities
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('[DB] WARNING: DATABASE_URL is not set in environment variables.');
}

// Global pool instance with connection pooling optimized for Neon / Serverless
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Required for Neon SSL connection
      },
      max: 20, // maximum connection pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client:', err);
    });
  }
  return pool;
}

/**
 * Execute a parameterized query against PostgreSQL.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const pool = getPool();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log('[SQL]', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[SQL Error]', { text, error });
    throw error;
  }
}

/**
 * Run operations within a single database transaction.
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
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
