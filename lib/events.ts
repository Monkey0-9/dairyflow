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
  return full;
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
