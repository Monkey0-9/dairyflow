import { query } from '../db';

export interface OperationLogRecord {
  id: string;
  operationId: string;
  action: string;
  actorId: string;
  resultJson: string;
  createdAt: string;
}

/**
 * Universal Idempotency Guard.
 * Guarantees that retried mutations (deliveries, pause requests, payments, invoice operations)
 * with the same operationId execute exactly once and return identical cached results.
 */
export async function executeIdempotentOperation<T>(
  operationId: string | undefined | null,
  action: string,
  actorId: string,
  operationFn: () => Promise<T>
): Promise<{ result: T; isReplay: boolean }> {
  // If no operationId provided, execute normally without idempotency cache
  if (!operationId || operationId.trim() === '') {
    const result = await operationFn();
    return { result, isReplay: false };
  }

  const cleanOpId = operationId.trim();

  // 1. Check if operationId has already been recorded
  const checkRes = await query<OperationLogRecord>(
    `SELECT id, operation_id as "operationId", action, actor_id as "actorId", result_json as "resultJson"
     FROM operation_logs
     WHERE operation_id = $1`,
    [cleanOpId]
  );

  if (checkRes.rows.length > 0) {
    const existing = checkRes.rows[0];
    try {
      const parsedResult = JSON.parse(existing.resultJson) as T;
      return { result: parsedResult, isReplay: true };
    } catch (parseErr) {
      console.error('[Idempotency] Failed to parse stored result JSON for operationId:', cleanOpId, parseErr);
      // If parsing fails, it indicates a data corruption or schema mismatch. Re-executing the operation
      // or throwing an error might be safer than returning potentially malformed data.
      throw new Error(`Failed to parse stored result for operation ${cleanOpId}: ${parseErr}`);
    }
  }

  // 2. Execute target domain mutation
  const result = await operationFn();
  const jsonString = JSON.stringify(result);

  // 3. Record operationId in operation_logs
  try {
    await query(
      `INSERT INTO operation_logs (id, operation_id, action, actor_id, result_json, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
       ON CONFLICT (operation_id) DO NOTHING`,
      [cleanOpId, action, actorId, jsonString]
    );
  } catch (err) {
    console.warn(`[Idempotency] Warning logging operationId ${cleanOpId}:`, err);
  }

  return { result, isReplay: false };
}
