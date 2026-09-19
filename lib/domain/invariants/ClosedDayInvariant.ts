import { query } from '@/lib/db';
import type { InvariantResult } from './CustomerOwnershipInvariant';

/**
 * ClosedDayInvariant: strict write-lock on finalized operational day records.
 * Pure check + DB-backed check.
 */
export function assertDayNotClosed(dayStatus: string | null | undefined): InvariantResult {
  if (dayStatus === 'FINALIZED') {
    return { valid: false, code: 'DAY_CLOSED', message: 'Operational day is FINALIZED; writes are locked.' };
  }
  return { valid: true, code: 'OK', message: 'Day is open for writes.' };
}

export async function assertDayNotClosedDb(params: {
  farmerId: string;
  date: string;
}): Promise<InvariantResult> {
  const res = await query<{ status: string }>(
    `SELECT status FROM day_closings WHERE farmer_id = $1 AND date = $2`,
    [params.farmerId, params.date],
  );
  const row = res.rows[0];
  if (!row) return { valid: true, code: 'OK', message: 'No day closing record; day is open.' };
  return assertDayNotClosed(row.status);
}
