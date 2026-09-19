import { query } from '@/lib/db';
import type { InvariantResult } from './CustomerOwnershipInvariant';

/**
 * PaymentIdempotencyInvariant: prohibits duplicate transaction references
 * and double credits.
 */
export function assertTransactionRefValid(transactionRef: string | null | undefined): InvariantResult {
  if (!transactionRef || transactionRef.trim() === '') {
    return { valid: false, code: 'EMPTY_TRANSACTION_REF', message: 'transactionRef must be non-empty.' };
  }
  return { valid: true, code: 'OK', message: 'transactionRef format valid.' };
}

export async function assertTransactionRefUnique(transactionRef: string): Promise<InvariantResult> {
  const fmt = assertTransactionRefValid(transactionRef);
  if (!fmt.valid) return fmt;
  const res = await query<{ id: string }>(`SELECT id FROM payments WHERE transaction_ref = $1`, [
    transactionRef,
  ]);
  if (res.rows.length > 0) {
    return {
      valid: false,
      code: 'DUPLICATE_TRANSACTION_REF',
      message: `transactionRef ${transactionRef} already exists; replay must return cached result, not a new credit.`,
      details: { existingPaymentId: res.rows[0].id },
    };
  }
  return { valid: true, code: 'OK', message: 'transactionRef is unique.' };
}
