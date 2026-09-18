import { describe, it, expect } from 'vitest';
import { GET as getHealthHandler } from '@/app/health/route';
import { GET as getReadyHandler } from '@/app/ready/route';
import { GET as getLiveHandler } from '@/app/live/route';
import { GET as getMetricsHandler } from '@/app/metrics/route';
import { NextRequest } from 'next/server';

describe('Stage 8: Observability 2.0 Integration Tests', () => {
  it('GET /health returns comprehensive diagnostic telemetry', async () => {
    const res = await getHealthHandler();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('HEALTHY');
    expect(json.services.database.status).toBe('UP');
    expect(json.services.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(json.system.memory.heapUsedMb).toBeGreaterThan(0);
  });

  it('GET /ready verifies live PostgreSQL readiness probe', async () => {
    const res = await getReadyHandler();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ready).toBe(true);
    expect(json.database).toBe('CONNECTED');
    expect(json.pool).toBeDefined();
  });

  it('GET /live verifies process uptime and non-blocking event loop', async () => {
    const res = await getLiveHandler();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.alive).toBe(true);
    expect(json.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('GET /metrics returns JSON metrics by default', async () => {
    const req = new NextRequest('http://localhost:3000/metrics');
    const res = await getMetricsHandler(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it('GET /metrics returns Prometheus text format when Accept header requests text/plain', async () => {
    const req = new NextRequest('http://localhost:3000/metrics', {
      headers: { accept: 'text/plain' },
    });
    const res = await getMetricsHandler(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('milkflow_http_requests_total');
    expect(text).toContain('milkflow_db_latency_ms');
  });
});
