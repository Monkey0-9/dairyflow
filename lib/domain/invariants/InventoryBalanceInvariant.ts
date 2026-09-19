import type { InvariantResult } from './CustomerOwnershipInvariant';

export interface InventoryBalance {
  openingStock: number;
  productionQuantity: number;
  deliveredQuantity: number;
  wasteQuantity: number;
  personalQuantity: number;
  closingStock: number;
}

const EPS = 1e-6;

/**
 * InventoryBalanceInvariant: Opening + Production = Delivered + Waste + Personal + Closing
 */
export function assertInventoryBalance(b: InventoryBalance): InvariantResult {
  for (const [k, v] of Object.entries(b)) {
    if (!Number.isFinite(v) || v < 0) {
      return { valid: false, code: 'NEGATIVE_INVENTORY', message: `Inventory field ${k} is ${v}; must be >= 0.` };
    }
  }
  const lhs = b.openingStock + b.productionQuantity;
  const rhs = b.deliveredQuantity + b.wasteQuantity + b.personalQuantity + b.closingStock;
  if (Math.abs(lhs - rhs) > EPS) {
    return {
      valid: false,
      code: 'INVENTORY_IMBALANCE',
      message: `Inventory imbalance: Opening(${b.openingStock}) + Production(${b.productionQuantity}) = ${lhs} != ${rhs} (Delivered + Waste + Personal + Closing).`,
      details: { lhs, rhs, variance: lhs - rhs },
    };
  }
  return { valid: true, code: 'OK', message: 'Inventory balance reconciled.' };
}
