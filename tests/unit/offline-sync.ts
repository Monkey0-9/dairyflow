import { describe, it, expect } from 'vitest';
import {
  resolveConflict,
  type OfflineOperation,
} from '@/lib/services/offline-sync.service';
import { startTrace, childSpan, traceHeaders, extractTrace, traceEvent } from '@/lib/observability/tracer';
import {
  enqueueOutbox,
  transition,
  canTransition,
  dueForRetry,
} from '@/lib/services/notification-outbox.service';

const baseOp: OfflineOperation = {
  operationId: 'op_1',
  recordId: 'rec_1',
  tenantId: 'tenant_greenvalley',
  actorId: 'user_farmer',
  deliveredQuantity: 2,
  status: 'DELIVERED',
  clientUpdatedAt: '2026-09-18T08:00:00.000Z',
  serverUpdatedAt: '2026-09-18T07:00:00.000Z',
};

describe('Offline-first delivery sync (server)', () => {
  it('applies newer client writes; rejects stale writes (server authority)', () => {
    expect(resolveConflict(baseOp).stale).toBe(false);
    const stale: OfflineOperation = { ...baseOp, clientUpdatedAt: '2026-09-18T06:00:00.000Z' };
    expect(resolveConflict(stale)).toMatchObject({ conflict: 'CLIENT_STALE', stale: true });
    // Timestamp tie -> server wins by default
    const tie: OfflineOperation = { ...baseOp, clientUpdatedAt: '2026-09-18T07:00:00.000Z' };
    expect(resolveConflict(tie, 'SERVER_WINS').stale).toBe(true);
    expect(resolveConflict(tie, 'CLIENT_WINS_IF_NEWER').stale).toBe(false);
  });

  it('processes idempotent batches without double-apply (DB-backed, skips without DB)', async () => {
    const { testConnection } = await import('@/lib/db');
    let alive = false;
    try {
      alive = await testConnection();
    } catch {
      alive = false;
    }
    if (!alive) return;
    const { processOfflineBatch } = await import('@/lib/services/offline-sync.service');
    let applies = 0;
    const apply = async () => {
      applies += 1;
      return { status: 'DELIVERED' };
    };
    const ops: OfflineOperation[] = [
      { ...baseOp, operationId: `batch_${Date.now()}_a` },
      { ...baseOp, operationId: `batch_${Date.now()}_a` }, // replay
    ];
    const acks = await processOfflineBatch(ops, apply);
    expect(acks[0].applied).toBe(true);
    expect(acks[1].isReplay).toBe(true);
    expect(applies).toBe(1);
  });
});

describe('End-to-end tracing', () => {
  it('generates unique trace/request ids and propagates via headers', () => {
    const a = startTrace({ tenantId: 't1' });
    const b = startTrace({ tenantId: 't1' });
    expect(a.traceId).not.toBe(b.traceId);
    expect(a.requestId).not.toBe(b.requestId);
    const child = childSpan(a);
    expect(child.parentSpanId).toBe(a.spanId);
    expect(child.traceId).toBe(a.traceId);
    const h = traceHeaders(a);
    expect(extractTrace({ get: (n: string) => (h as Record<string, string>)[n] ?? null }).traceId).toBe(a.traceId);
    const evt = traceEvent(a, 'invoice.generated', { invoiceId: 'INV_1' });
    expect(evt.traceId).toBe(a.traceId);
    expect(evt.event).toBe('invoice.generated');
  });
});

describe('Notification outbox state machine', () => {
  it('enforces QUEUED -> PROCESSING -> SENT|DELIVERED|FAILED -> RETRYING -> DEAD_LETTER', () => {
    let m = enqueueOutbox({ tenantId: 't1', channel: 'SMS', event: 'payment:received', recipient: '+911', body: 'hi' });
    expect(m.state).toBe('QUEUED');
    expect(canTransition('QUEUED', 'SENT')).toBe(false);
    m = transition(m, 'PROCESSING');
    m = transition(m, 'SENT');
    m = transition(m, 'DELIVERED');
    expect(m.state).toBe('DELIVERED');
    expect(() => transition(m, 'RETRYING')).toThrow();
  });

  it('retries with backoff then dead-letters after max attempts', () => {
    let m = enqueueOutbox({ tenantId: 't1', channel: 'EMAIL', event: 'invoice:generated', recipient: 'a@b.in', body: 'bill', maxAttempts: 2 });
    m = transition(m, 'PROCESSING');
    m = transition(m, 'FAILED', 'smtp down');
    expect(m.state).toBe('FAILED');
    expect(m.attempts).toBe(1);
    m = transition(m, 'RETRYING');
    m = transition(m, 'PROCESSING');
    m = transition(m, 'FAILED', 'smtp down again');
    expect(m.state).toBe('DEAD_LETTER');
    expect(dueForRetry([m]).length).toBe(0);
  });
});
