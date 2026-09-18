import { NextRequest, NextResponse } from 'next/server';
import { telemetry } from '@/lib/observability';

export const dynamic = 'force-dynamic';

/**
 * GET /metrics
 * Production Observability 2.0 endpoint.
 * Returns Prometheus text format if 'Accept: text/plain' is requested, or JSON format by default.
 */
export async function GET(req: NextRequest) {
  const accept = req.headers.get('accept') || '';

  if (accept.includes('text/plain')) {
    return new NextResponse(telemetry.toPrometheusFormat(), {
      status: 200,
      headers: {
        'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  }

  return NextResponse.json({
    success: true,
    metrics: telemetry.getMetrics(),
  }, { status: 200 });
}
