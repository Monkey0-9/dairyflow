import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /live
 * Kubernetes / Cloud Run Liveness Probe.
 * Returns 200 if Node.js process is active and event loop is non-blocking.
 */
export async function GET() {
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);

  return NextResponse.json({
    alive: true,
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    memory: {
      heapUsedMb,
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  }, { status: 200 });
}
