import type { InvariantResult } from './CustomerOwnershipInvariant';

/**
 * InvoiceImmutabilityInvariant: issued invoices cannot be altered without
 * a credit/debit adjustment note. Direct field mutation is rejected.
 */
export function assertInvoiceMutationAllowed(params: {
  hasAdjustmentNote: boolean;
  attemptedFields: string[];
}): InvariantResult {
  const IMMUTABLE = new Set(['total_amount', 'total_quantity', 'month', 'year', 'customer_id']);
  const hits = params.attemptedFields.filter((f) => IMMUTABLE.has(f));
  if (hits.length > 0 && !params.hasAdjustmentNote) {
    return {
      valid: false,
      code: 'INVOICE_IMMUTABLE',
      message: `Invoice fields [${hits.join(', ')}] are immutable without a credit/debit adjustment note.`,
      details: { attemptedFields: hits },
    };
  }
  return { valid: true, code: 'OK', message: 'Invoice mutation allowed.' };
}
