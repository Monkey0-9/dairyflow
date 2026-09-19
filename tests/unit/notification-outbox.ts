import { describe, it, expect } from 'vitest';
import {
  enqueueOutbox,
  canTransition,
  transition,
  dueForRetry,
} from '@/lib/services/notification-outbox.service';

describe('Move 10: Production Notification Outbox & State Machine Tests', () => {
  it('transitions through complete notification lifecycle states', () => {
    const msg = enqueueOutbox({
      tenantId: 'tenant_greenvalley',
      channel: 'WHATSAPP',
      event: 'INVOICE_GENERATED',
      recipient: '+91 98765 43210',
      body: 'Invoice #101 is ready',
      maxAttempts: 3,
    });

    expect(msg.state).toBe('QUEUED');
    expect(canTransition('QUEUED', 'PROCESSING')).toBe(true);

    // 1. QUEUED -> PROCESSING
    const processing = transition(msg, 'PROCESSING');
    expect(processing.state).toBe('PROCESSING');

    // 2. PROCESSING -> SENT
    const sent = transition(processing, 'SENT');
    expect(sent.state).toBe('SENT');

    // 3. SENT -> DELIVERED
    const delivered = transition(sent, 'DELIVERED');
    expect(delivered.state).toBe('DELIVERED');

    // 4. Test failure with retry backoff
    const failed1 = transition(processing, 'FAILED', 'Connection timeout');
    expect(failed1.state).toBe('FAILED');
    expect(failed1.attempts).toBe(1);
    expect(failed1.nextRetryAt).toBeDefined();

    // 5. Test retry & dead letter
    const retrying = transition(failed1, 'RETRYING');
    expect(retrying.state).toBe('RETRYING');
    const deadLetter = transition(retrying, 'DEAD_LETTER', 'Fatal rejection');
    expect(deadLetter.state).toBe('DEAD_LETTER');
  });

  it('identifies messages due for retry', () => {
    const msg = enqueueOutbox({
      tenantId: 'tenant_greenvalley',
      channel: 'SMS',
      event: 'DELIVERY_CONFIRMED',
      recipient: '+91 99999 88888',
      body: '2L Cow Milk delivered',
    });

    msg.state = 'RETRYING';
    msg.nextRetryAt = new Date(Date.now() - 10000).toISOString();

    const due = dueForRetry([msg]);
    expect(due.length).toBe(1);
  });
});
