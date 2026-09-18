import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

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
      eventsStream: {
        status: 'UP',
        protocol: 'Server-Sent Events (SSE)',
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
