/**
 * Move 10: Production Notification Outbox & State Machine.
 * Decouples financial/delivery transactions from synchronous external
 * notification gateways: QUEUED -> PROCESSING -> SENT | DELIVERED | FAILED
 * -> RETRYING -> DEAD_LETTER.
 */

export type OutboxState =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETRYING'
  | 'DEAD_LETTER';

export interface OutboxMessage {
  id: string;
  tenantId: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  event: string;
  recipient: string;
  body: string;
  state: OutboxState;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

const TRANSITIONS: Record<OutboxState, OutboxState[]> = {
  QUEUED: ['PROCESSING'],
  PROCESSING: ['SENT', 'FAILED', 'DELIVERED'],
  SENT: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['RETRYING', 'DEAD_LETTER'],
  RETRYING: ['PROCESSING', 'DEAD_LETTER'],
  DEAD_LETTER: [],
};

export function canTransition(from: OutboxState, to: OutboxState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transition(msg: OutboxMessage, to: OutboxState, error?: string): OutboxMessage {
  if (!canTransition(msg.state, to)) {
    throw new Error(`Illegal outbox transition ${msg.state} -> ${to}`);
  }
  const now = new Date().toISOString();
  const next: OutboxMessage = {
    ...msg,
    state: to,
    updatedAt: now,
    lastError: error ?? (to === 'FAILED' ? msg.lastError : null),
  };
  if (to === 'FAILED') {
    next.attempts += 1;
    if (next.attempts >= next.maxAttempts) {
      next.state = 'DEAD_LETTER';
      next.nextRetryAt = null;
    } else {
      // Exponential backoff: 30s * 2^attempts
      const delayMs = 30_000 * Math.pow(2, next.attempts);
      next.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    }
  }
  if (to === 'RETRYING') {
    next.nextRetryAt = new Date(Date.now() + 30_000).toISOString();
  }
  return next;
}

export function enqueueOutbox(params: {
  id?: string;
  tenantId: string;
  channel: OutboxMessage['channel'];
  event: string;
  recipient: string;
  body: string;
  maxAttempts?: number;
}): OutboxMessage {
  const now = new Date().toISOString();
  return {
    id: params.id ?? `out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: params.tenantId,
    channel: params.channel,
    event: params.event,
    recipient: params.recipient,
    body: params.body,
    state: 'QUEUED',
    attempts: 0,
    maxAttempts: params.maxAttempts ?? 5,
    nextRetryAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function dueForRetry(msgs: OutboxMessage[], now = new Date()): OutboxMessage[] {
  return msgs.filter(
    (m) => m.state === 'FAILED' || (m.state === 'RETRYING' && (!m.nextRetryAt || new Date(m.nextRetryAt) <= now)),
  );
}
