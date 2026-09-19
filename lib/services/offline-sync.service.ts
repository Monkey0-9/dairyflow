import { executeIdempotentOperation } from '@/lib/security/idempotency';

/**
 * Move 8: Offline-First Delivery Reliability (server side).
 * Client queue serialization (operationId) + server idempotent batch
 * processing + conflict resolution (server authority wins when timestamps
 * tie or client clock is skewed) + status acknowledgment.
 */

export interface OfflineOperation {
  operationId: string;
  recordId: string;
  tenantId: string;
  actorId: string;
  deliveredQuantity?: number;
  status?: string;
  clientUpdatedAt: string; // ISO timestamp from client queue
  serverUpdatedAt?: string | null; // last known server timestamp
}

export type ConflictPolicy = 'SERVER_WINS' | 'CLIENT_WINS_IF_NEWER';

export interface BatchAck {
  operationId: string;
  recordId: string;
  applied: boolean;
  isReplay: boolean;
  conflict: 'NONE' | 'CLIENT_STALE' | 'SERVER_STALE';
  resolvedStatus?: string;
}

export function resolveConflict(
  op: OfflineOperation,
  policy: ConflictPolicy = 'SERVER_WINS',
): { conflict: BatchAck['conflict']; stale: boolean } {
  if (!op.serverUpdatedAt) return { conflict: 'NONE', stale: false };
  const clientT = new Date(op.clientUpdatedAt).getTime();
  const serverT = new Date(op.serverUpdatedAt).getTime();
  if (!Number.isFinite(clientT) || !Number.isFinite(serverT)) {
    return { conflict: 'CLIENT_STALE', stale: true };
  }
  if (clientT < serverT) return { conflict: 'CLIENT_STALE', stale: true };
  if (clientT === serverT && policy === 'SERVER_WINS') {
    return { conflict: 'CLIENT_STALE', stale: true };
  }
  return { conflict: 'NONE', stale: false };
}

/**
 * Idempotent batch processor. Each operation executes at most once per
 * operationId; stale client writes are acknowledged without mutation.
 */
export async function processOfflineBatch(
  ops: OfflineOperation[],
  apply: (op: OfflineOperation) => Promise<{ status: string }>,
  policy: ConflictPolicy = 'SERVER_WINS',
): Promise<BatchAck[]> {
  const acks: BatchAck[] = [];
  for (const op of ops) {
    const { conflict, stale } = resolveConflict(op, policy);
    if (stale) {
      acks.push({ operationId: op.operationId, recordId: op.recordId, applied: false, isReplay: false, conflict });
      continue;
    }
    const { result, isReplay } = await executeIdempotentOperation(
      op.operationId,
      'OFFLINE_DELIVERY_SYNC',
      op.actorId,
      () => apply(op),
    );
    acks.push({
      operationId: op.operationId,
      recordId: op.recordId,
      applied: !isReplay,
      isReplay,
      conflict: 'NONE',
      resolvedStatus: (result as { status: string })?.status,
    });
  }
  return acks;
}
