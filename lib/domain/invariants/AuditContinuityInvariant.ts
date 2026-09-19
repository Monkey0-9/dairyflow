import { createHash } from 'crypto';
import type { InvariantResult } from './CustomerOwnershipInvariant';

export interface AuditBlockInput {
  index: number;
  timestamp: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState?: string | null;
  afterState?: string | null;
  previousHash: string;
  currentHash: string;
}

export function computeAuditHash(b: Omit<AuditBlockInput, 'currentHash'>): string {
  const payload = [
    b.index,
    b.timestamp,
    b.actorId,
    b.actorRole,
    b.entityType,
    b.entityId,
    b.action,
    b.beforeState ?? '',
    b.afterState ?? '',
    b.previousHash,
  ].join('|');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * AuditContinuityInvariant: validates SHA-256 block hash chaining and tampering prevention.
 */
export function assertAuditContinuity(blocks: AuditBlockInput[]): InvariantResult {
  if (!blocks || blocks.length === 0) {
    return { valid: true, code: 'OK', message: 'Audit chain is empty.' };
  }

  const sorted = [...blocks].sort((a, b) => a.index - b.index);
  for (let i = 0; i < sorted.length; i++) {
    const blk = sorted[i];
    if (i > 0) {
      if (blk.index !== sorted[i - 1].index + 1) {
        return { valid: false, code: 'AUDIT_INDEX_GAP', message: `Audit index gap at ${blk.index}.` };
      }
      if (blk.previousHash !== sorted[i - 1].currentHash) {
        return {
          valid: false,
          code: 'AUDIT_CHAIN_BREAK',
          message: `Audit block ${blk.index} previousHash does not match prior currentHash.`,
          details: { tamperedBlockIndex: blk.index },
        };
      }
    }
    const expected = computeAuditHash(blk);
    if (expected !== blk.currentHash) {
      return {
        valid: false,
        code: 'AUDIT_TAMPER_DETECTED',
        message: `Audit block ${blk.index} hash mismatch; tampering detected.`,
        details: { expected, actual: blk.currentHash, tamperedBlockIndex: blk.index },
      };
    }
  }

  return { valid: true, code: 'OK', message: `Audit chain continuous and untampered across ${sorted.length} blocks.` };
}
