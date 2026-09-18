/**
 * In-process tenant/user-scoped event bus for Server-Sent Events fan-out.
 * Phase 2: Live Real-Time Push Notifications.
 */

export type MilkFlowEventType =
  | 'request:created'
  | 'request:approved'
  | 'request:rejected'
  | 'delivery:updated'
  | 'payment:received'
  | 'dispute:opened'
  | 'dispute:resolved'
  | 'invoice:created';

export interface MilkFlowEvent {
  type: MilkFlowEventType;
  tenantId?: string;
  farmerId?: string;
  customerId?: string;
  userId?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

type Listener = (event: MilkFlowEvent) => void;

const listeners = new Set<Listener>();
const history: MilkFlowEvent[] = [];
const MAX_HISTORY = 200;

function upstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || process.env.VITEST === 'true') return null;
  return { url, token };
}

export function outboxKey(tenantId?: string): string {
  return `milkflow_outbox_${tenantId || 'global'}`;
}

async function publishToUpstash(channel: string, payload: unknown, tenantId?: string) {
  const cfg = upstashConfig();
  if (!cfg) return;
  try {
    // Fan-out to live subscribers AND persist to a bounded outbox list so
    // polling readers on other serverless instances can catch up.
    await fetch(`${cfg.url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['PUBLISH', channel, JSON.stringify(payload)],
        ['LPUSH', outboxKey(tenantId), JSON.stringify(payload)],
        ['LTRIM', outboxKey(tenantId), '0', '199'],
      ]),
    });
  } catch (err) {
    console.warn('[events] Upstash publish failed:', err);
  }
}

export function publishEvent(event: Omit<MilkFlowEvent, 'timestamp'>): MilkFlowEvent {
  const full: MilkFlowEvent = { ...event, timestamp: new Date().toISOString() };
  history.push(full);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  for (const listener of Array.from(listeners)) {
    try {
      listener(full);
    } catch (err) {
      console.error('[events] listener error:', err);
    }
  }

  // Publish to Redis channel (scoped per tenant) + persistent outbox
  const channel = `milkflow_events_${full.tenantId || 'global'}`;
  publishToUpstash(channel, full, full.tenantId).catch(() => {});

  return full;
}

/**
 * Read cross-instance outbox entries from Upstash (LRANGE).
 * Returns [] when Redis is unconfigured (single-instance/dev mode).
 */
export async function readOutbox(tenantId?: string, limit = 50): Promise<MilkFlowEvent[]> {
  const cfg = upstashConfig();
  if (!cfg) return [];
  try {
    const keys = tenantId && tenantId !== 'global'
      ? [outboxKey(tenantId), outboxKey(undefined)]
      : [outboxKey(undefined)];
    const out: MilkFlowEvent[] = [];
    for (const key of keys) {
      const res = await fetch(`${cfg.url}/lrange/${encodeURIComponent(key)}/0/${limit - 1}`, {
        headers: { Authorization: `Bearer ${cfg.token}` },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { result?: string[] };
      for (const raw of data.result || []) {
        try {
          const evt = JSON.parse(raw) as MilkFlowEvent;
          if (evt && evt.type && evt.timestamp) out.push(evt);
        } catch { /* skip corrupt entries */ }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Lightweight Redis reachability probe for /api/health. */
export async function pingOutbox(): Promise<{ configured: boolean; reachable: boolean; latencyMs: number }> {
  const cfg = upstashConfig();
  if (!cfg || process.env.VITEST === 'true') return { configured: !!cfg, reachable: false, latencyMs: -1 };
  const start = Date.now();
  try {
    const res = await fetch(`${cfg.url}/ping`, { headers: { Authorization: `Bearer ${cfg.token}` } });
    return { configured: true, reachable: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { configured: true, reachable: false, latencyMs: Date.now() - start };
  }
}

export function subscribeEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Scope filter: a subscriber with tenant/farmer/customer context only
 * receives events addressed to its scope (or global events without scope).
 */
export function eventVisibleTo(
  event: MilkFlowEvent,
  scope: { tenantId?: string; farmerId?: string; customerId?: string; userId?: string; role?: string }
): boolean {
  if (scope.role === 'ADMIN' || scope.role === 'SUPERADMIN') return true;
  if (event.tenantId && scope.tenantId && event.tenantId !== scope.tenantId) return false;
  if (scope.customerId) {
    if (event.customerId && event.customerId !== scope.customerId) return false;
    if (event.userId && scope.userId && event.userId !== scope.userId) return false;
  }
  if (scope.farmerId && event.customerId && !event.farmerId) {
    // farmer sees all customer events within tenant (already tenant-filtered)
    return true;
  }
  return true;
}

export function getRecentEvents(limit = 20): MilkFlowEvent[] {
  return history.slice(-limit);
}
