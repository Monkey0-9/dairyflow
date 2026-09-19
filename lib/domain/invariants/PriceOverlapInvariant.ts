import type { InvariantResult } from './CustomerOwnershipInvariant';
import { rangesOverlap } from './SubscriptionOverlapInvariant';

export interface PricePeriod {
  id?: string;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  pricePerUnit: number;
}

/**
 * PriceOverlapInvariant: enforces non-overlapping product pricing windows
 * and non-negative prices.
 */
export function assertNoPriceOverlap(periods: PricePeriod[]): InvariantResult {
  for (const p of periods) {
    if (!Number.isFinite(p.pricePerUnit) || p.pricePerUnit < 0) {
      return {
        valid: false,
        code: 'NEGATIVE_PRICE',
        message: `Price period ${p.id ?? ''} has invalid price ${p.pricePerUnit}. Must be >= 0.`,
      };
    }
  }
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      if (rangesOverlap(periods[i], periods[j])) {
        return {
          valid: false,
          code: 'PRICE_OVERLAP',
          message: `Price periods ${periods[i].id ?? i} and ${periods[j].id ?? j} overlap.`,
          details: { a: periods[i], b: periods[j] },
        };
      }
    }
  }
  return { valid: true, code: 'OK', message: 'No price period overlap.' };
}
