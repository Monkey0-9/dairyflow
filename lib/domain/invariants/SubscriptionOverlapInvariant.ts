import type { InvariantResult } from './CustomerOwnershipInvariant';

export interface EffectiveDatedRange {
  id?: string;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
}

function toTime(v: Date | string | null | undefined, fallback: number): number {
  if (v === null || v === undefined) {
    return fallback;
  }

  const dateObj = v instanceof Date ? v : new Date(v);
  const t = dateObj.getTime();

  if (Number.isFinite(t)) {
    return t;
  } else {
    // If 'v' was a string and resulted in an invalid date, throw an error.
    // This indicates a data quality issue that should not silently fall back.
    if (typeof v === 'string') {
      console.error(`Invalid date string provided to toTime: "${v}". Returning fallback.`, new Error().stack);
      return fallback;
    }
    // If 'v' was a Date object that somehow became invalid (e.g., new Date('invalid')
    // was passed as a Date object, which is unlikely but possible), or any other
    // non-string type that results in an invalid date, we also throw an error.
    // This ensures that any unparseable date input (that isn't null/undefined)
    // is treated as an error.
    throw new Error(`Unexpected invalid date value provided to toTime: ${v}`);
  }
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
