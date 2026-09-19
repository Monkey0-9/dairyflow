import { query } from '@/lib/db';
import type { InvariantResult } from './CustomerOwnershipInvariant';

/**
 * ClosedMonthInvariant: strict lock preventing invoice mutations after month closure.
 */
export function assertMonthNotClosed(monthStatus: string | null | undefined): InvariantResult {
  if (monthStatus === 'FINALIZED') {
    return { valid: false, code: 'MONTH_CLOSED', message: 'Month is FINALIZED; invoice mutations are locked.' };
  }
  return { valid: true, code: 'OK', message: 'Month is open for invoice mutations.' };
}

export async function assertMonthNotClosedDb(params: {
  farmerId: string;
  month: number;
  year: number;
}): Promise<InvariantResult> {
  const res = await query<{ status: string }>(
    `SELECT status FROM month_closings WHERE farmer_id = $1 AND month = $2 AND year = $3`,
    [params.farmerId, params.month, params.year],
  );
  const row = res.rows[0];
  if (!row) return { valid: true, code: 'OK', message: 'No month closing record; month is open.' };
  return assertMonthNotClosed(row.status);
}
