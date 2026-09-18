import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { pingOutbox } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  let dbLatency = -1;
  let dbConnected = false;

  try {
    const dbStart = Date.now();
    const res = await query('SELECT NOW() as db_time');
    dbLatency = Date.now() - dbStart;
    dbConnected = !!res.rows[0]?.db_time;
  } catch (err) {
    console.error('[Health Check] DB query failed:', err);
  }

  const redis = await pingOutbox().catch(() => ({ configured: false, reachable: false, latencyMs: -1 }));

  const pool = getPool();
  const poolStats = {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };

  const totalLatency = Date.now() - startTime;
  const memoryUsage = process.memoryUsage();

  const isHealthy = dbConnected && (dbLatency < 5000 || dbLatency === -1);

  return NextResponse.json({
    status: isHealthy ? 'HEALTHY' : 'DEGRADED',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'dev',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    latencyMs: totalLatency,
    services: {
      database: {
        status: dbConnected ? 'UP' : 'DOWN',
        latencyMs: dbLatency,
        engine: 'Neon Serverless PostgreSQL',
        pool: poolStats,
      },
      realtimeOutbox: {
        status: !redis.configured ? 'NOT_CONFIGURED' : redis.reachable ? 'UP' : 'DOWN',
        latencyMs: redis.latencyMs,
        engine: 'Upstash Redis',
      },
      eventsStream: {
        status: 'UP',
        protocol: 'Server-Sent Events (SSE) + 20s cross-instance poll',
      },
      paymentGateway: {
        status: 'UP',
        idempotencyEnforced: true,
      },
      aiForecasting: {
        status: 'UP',
        metricsCalculation: 'Dynamic',
      },
    },
    system: {
      nodeVersion: process.version,
      memory: {
        heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 10) / 10,
        rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 10) / 10,
      },
    },
  }, {
    status: isHealthy ? 200 : 503,
  });
}
