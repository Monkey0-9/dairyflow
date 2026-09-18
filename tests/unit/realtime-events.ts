import { describe, it, expect } from 'vitest';
import {
  publishEvent,
  subscribeEvents,
  eventVisibleTo,
  getRecentEvents,
  outboxKey,
  readOutbox,
  pingOutbox,
} from '@/lib/events';

describe('Unit: realtime event bus (serverless-safe)', () => {
  it('publishes and delivers to subscribers', () => {
    const seen: string[] = [];
    const unsub = subscribeEvents((e) => {
      seen.push(e.type);
    });
    publishEvent({ type: 'delivery:updated', tenantId: 't1', payload: { a: 1 } });
    unsub();
    expect(seen).toContain('delivery:updated');
  });

  it('unsubscribe stops delivery', () => {
    let count = 0;
    const unsub = subscribeEvents(() => {
      count += 1;
    });
    unsub();
    publishEvent({ type: 'payment:received', tenantId: 't1' });
    expect(count).toBe(0);
  });

  it('superadmin sees everything; tenants are isolated', () => {
    const evt = publishEvent({ type: 'request:created', tenantId: 'tenant_a', customerId: 'c1' });
    expect(eventVisibleTo(evt, { role: 'SUPERADMIN' })).toBe(true);
    expect(eventVisibleTo(evt, { role: 'ADMIN' })).toBe(true);
    expect(eventVisibleTo(evt, { tenantId: 'tenant_a', role: 'FARMER' })).toBe(true);
    expect(eventVisibleTo(evt, { tenantId: 'tenant_b', role: 'FARMER' })).toBe(false);
  });

  it('customers only see their own events', () => {
    const mine = publishEvent({ type: 'request:approved', tenantId: 't1', customerId: 'c1' });
    const other = publishEvent({ type: 'request:approved', tenantId: 't1', customerId: 'c2' });
    expect(eventVisibleTo(mine, { tenantId: 't1', customerId: 'c1', role: 'CUSTOMER' })).toBe(true);
    expect(eventVisibleTo(other, { tenantId: 't1', customerId: 'c1', role: 'CUSTOMER' })).toBe(false);
  });

  it('history is bounded', () => {
    for (let i = 0; i < 210; i++) {
      publishEvent({ type: 'delivery:updated', tenantId: 't-cap' });
    }
    expect(getRecentEvents(500).length).toBeLessThanOrEqual(200);
  });

  it('outbox keys are tenant-scoped', () => {
    expect(outboxKey('tenant_x')).toBe('milkflow_outbox_tenant_x');
    expect(outboxKey()).toBe('milkflow_outbox_global');
  });

  it('readOutbox returns [] without Redis config', async () => {
    const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
    const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    try {
      await expect(readOutbox('t1')).resolves.toEqual([]);
    } finally {
      if (savedUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
      if (savedToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    }
  });

  it('pingOutbox reports unconfigured without Redis', async () => {
    const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
    const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    try {
      const res = await pingOutbox();
      expect(res.configured).toBe(false);
      expect(res.reachable).toBe(false);
    } finally {
      if (savedUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
      if (savedToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    }
  });
});
