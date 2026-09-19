import type { InvariantResult } from './CustomerOwnershipInvariant';

export interface EffectiveDatedRange {
  id?: string;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
}

function toTime(v: Date | string | null | undefined, fallback: number): number {
  if (v === null || v === undefined) return fallback;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(t) ? t : fallback;
}

/**
 * Pure overlap check: StartA < EndB AND EndA > StartB.
 * Open-ended (null) end maps to +Infinity.
 */
export function rangesOverlap(
  a: EffectiveDatedRange,
  b: EffectiveDatedRange,
): boolean {
  const aStart = toTime(a.effectiveFrom, -Infinity);
  const aEnd = toTime(a.effectiveTo ?? null, Infinity);
  const bStart = toTime(b.effectiveFrom, -Infinity);
  const bEnd = toTime(b.effectiveTo ?? null, Infinity);
  return aStart < bEnd && aEnd > bStart;
}

/**
 * SubscriptionOverlapInvariant: guarantees non-overlapping subscription
 * version time intervals for a single customer.
 */
export function assertNoSubscriptionOverlap(
  versions: EffectiveDatedRange[],
): InvariantResult {
  for (let i = 0; i < versions.length; i++) {
    for (let j = i + 1; j < versions.length; j++) {
      if (rangesOverlap(versions[i], versions[j])) {
        return {
          valid: false,
          code: 'SUBSCRIPTION_OVERLAP',
          message: `Subscription versions ${versions[i].id ?? i} and ${versions[j].id ?? j} overlap.`,
          details: { a: versions[i], b: versions[j] },
        };
      }
    }
  }
  return { valid: true, code: 'OK', message: 'No subscription version overlap.' };
}
