/**
 * Unified invariant runner: composes all domain laws before and during persistence.
 * Each check returns InvariantResult; runInvariants short-circuits on first failure
 * but runAllInvariants collects every result for audit reporting.
 */
import type { InvariantResult } from './CustomerOwnershipInvariant';

export { assertCustomerOwnership } from './CustomerOwnershipInvariant';
export { assertTenantIsolationCascade } from './TenantIsolationInvariant';
export { assertNoSubscriptionOverlap, rangesOverlap } from './SubscriptionOverlapInvariant';
export { assertNoPriceOverlap } from './PriceOverlapInvariant';
export { assertDeliveryTransition, DELIVERY_TRANSITIONS } from './DeliveryStateInvariant';
export { assertDayNotClosed, assertDayNotClosedDb } from './ClosedDayInvariant';
export { assertMonthNotClosed, assertMonthNotClosedDb } from './ClosedMonthInvariant';
export { assertInvoiceMutationAllowed } from './InvoiceImmutabilityInvariant';
export {
  assertTransactionRefValid,
  assertTransactionRefUnique,
} from './PaymentIdempotencyInvariant';
export { assertInventoryBalance } from './InventoryBalanceInvariant';
export {
  assertAuditContinuity,
  computeAuditHash,
} from './AuditContinuityInvariant';

export type InvariantCheck = () => InvariantResult | Promise<InvariantResult>;

export async function runInvariants(checks: InvariantCheck[]): Promise<InvariantResult> {
  for (const check of checks) {
    const r = await check();
    if (!r.valid) return r;
  }
  return { valid: true, code: 'OK', message: 'All invariants satisfied.' };
}

export async function runAllInvariants(
  checks: InvariantCheck[],
): Promise<{ valid: boolean; results: InvariantResult[] }> {
  const results: InvariantResult[] = [];
  for (const check of checks) {
    results.push(await check());
  }
  return { valid: results.every((r) => r.valid), results };
}
