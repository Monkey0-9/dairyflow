import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { telemetry } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * GET /ready
 * Kubernetes / Cloud Run Readiness Probe.
 * Returns 200 if PostgreSQL connection pool is receptive and healthy.
 */
export async function GET() {
  const start = Date.now();
  try {
    const res = await query('SELECT 1 as ready');
    const latency = Date.now() - start;
    const pool = getPool();

    telemetry.recordDbLatency(latency, pool.totalCount);

    if (res.rows[0]?.ready === 1) {
      return NextResponse.json({
        ready: true,
        database: 'CONNECTED',
        latencyMs: latency,
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      }, { status: 200 });
    }

    return NextResponse.json({ ready: false, error: 'Database response invalid' }, { status: 503 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Database check failed';
    return NextResponse.json({ ready: false, database: 'DISCONNECTED', error: msg }, { status: 503 });
  }
}
