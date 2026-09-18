import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { authorizeCron } from '@/lib/cron-auth';

function cronRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers.authorization = `Bearer ${secret}`;
  return new NextRequest('http://localhost:3000/api/cron/daily-check', { headers });
}

describe('Unit: cron authorization', () => {
  const saved = process.env.CRON_SECRET;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  });

  it('allows the correct secret', () => {
    process.env.CRON_SECRET = 's3cret';
    try {
      expect(authorizeCron(cronRequest('s3cret'))).toBeNull();
    } finally {
      if (saved === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = saved;
    }
  });

  it('rejects wrong or missing secrets', () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const res = authorizeCron(cronRequest('wrong'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const res2 = authorizeCron(cronRequest());
    expect(res2!.status).toBe(401);
  });

  it('fails closed in production without CRON_SECRET', () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.CRON_SECRET;
    const res = authorizeCron(cronRequest('anything'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
  });
});
