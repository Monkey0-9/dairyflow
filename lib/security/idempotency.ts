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
    } catch {
      // Return raw string if JSON parsing fails
      return { result: existing.resultJson as unknown as T, isReplay: true };
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
