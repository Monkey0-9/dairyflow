import type { InvariantResult } from './CustomerOwnershipInvariant';

/** Canonical delivery FSM. EXPECTED is the only ingress; terminal states have no egress. */
export const DELIVERY_TRANSITIONS: Record<string, string[]> = {
  EXPECTED: ['DELIVERED', 'PARTIAL', 'SKIPPED', 'EXTRA', 'NOT_DELIVERED', 'DISPUTED', 'MISSED', 'PAUSED'],
  PARTIAL: ['DISPUTED'],
  EXTRA: ['DISPUTED'],
  DISPUTED: ['DELIVERED', 'NOT_DELIVERED'],
  DELIVERED: [],
  SKIPPED: [],
  NOT_DELIVERED: [],
  MISSED: [],
  PAUSED: [],
};

export function assertDeliveryTransition(from: string, to: string): InvariantResult {
  const allowed = DELIVERY_TRANSITIONS[from];
  if (!allowed) {
    return { valid: false, code: 'UNKNOWN_DELIVERY_STATE', message: `Unknown delivery state: ${from}` };
  }
  if (!allowed.includes(to)) {
    return {
      valid: false,
      code: 'ILLEGAL_DELIVERY_TRANSITION',
      message: `Illegal delivery transition ${from} -> ${to}. Allowed: [${allowed.join(', ')}]`,
      details: { from, to, allowed },
    };
  }
  return { valid: true, code: 'OK', message: `Delivery transition ${from} -> ${to} allowed.` };
}
