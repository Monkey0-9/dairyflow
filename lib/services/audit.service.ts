import { query, transaction } from '../db';
import crypto from 'crypto';

export interface AuditBlockRecord {
  id: string;
  tenantId: string;
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

export function computeBlockHash(data: {
  index: number;
  timestamp: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState: string;
  afterState: string;
  previousHash: string;
}): string {
  const payload = `${data.index}|${data.timestamp}|${data.actorId}|${data.actorRole}|${data.entityType}|${data.entityId}|${data.action}|${data.beforeState}|${data.afterState}|${data.previousHash}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Append a tamper-evident SHA-256 block to the tenant's audit trail.
 */
export async function appendAuditLog(params: {
  tenantId: string;
  actorId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}): Promise<AuditBlockRecord> {
  return transaction(async (client) => {
    // Get last block for this tenant
    const lastRes = await client.query(
      `SELECT index, current_hash FROM audit_blocks WHERE tenant_id = $1 ORDER BY index DESC LIMIT 1 FOR UPDATE`,
      [params.tenantId]
    );

    const index = lastRes.rows.length > 0 ? lastRes.rows[0].index + 1 : 0;
    const previousHash = lastRes.rows.length > 0 ? lastRes.rows[0].current_hash : '0000000000000000000000000000000000000000000000000000000000000000';
    const timestamp = new Date().toISOString();
    const beforeStateStr = JSON.stringify(params.beforeState || {});
    const afterStateStr = JSON.stringify(params.afterState || {});

    const currentHash = computeBlockHash({
      index,
      timestamp,
      actorId: params.actorId,
      actorRole: params.actorRole,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      beforeState: beforeStateStr,
      afterState: afterStateStr,
      previousHash,
    });

    const blockId = `BLOCK_${params.tenantId}_${index}`;

    await client.query(
      `INSERT INTO audit_blocks (id, tenant_id, index, timestamp, actor_id, actor_role, entity_type, entity_id, action, before_state, after_state, previous_hash, current_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        blockId,
        params.tenantId,
        index,
        timestamp,
        params.actorId,
        params.actorRole,
        params.entityType,
        params.entityId,
        params.action,
        beforeStateStr,
        afterStateStr,
        previousHash,
        currentHash,
      ]
    );

    return {
      id: blockId,
      tenantId: params.tenantId,
      index,
      timestamp,
      actorId: params.actorId,
      actorRole: params.actorRole,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      beforeState: beforeStateStr,
      afterState: afterStateStr,
      previousHash,
      currentHash,
    };
  });
}

/**
 * Mathematically verify the cryptographic integrity of the audit blockchain for a tenant.
 */
export async function verifyAuditChain(tenantId: string): Promise<{
  valid: boolean;
  totalBlocks: number;
  tamperedBlockIndex?: number;
  reason?: string;
}> {
  try {
    const res = await query<{
      id: string;
      tenant_id: string;
      index: number;
      timestamp: string | Date;
      actor_id: string;
      actor_role: string;
      entity_type: string;
      entity_id: string;
      action: string;
      before_state?: string | null;
      after_state?: string | null;
      previous_hash: string;
      current_hash: string;
    }>(
      `SELECT * FROM audit_blocks WHERE tenant_id = $1 ORDER BY index ASC`,
      [tenantId]
    );

    const blocks: AuditBlockRecord[] = res.rows.map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      index: Number(r.index),
      timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
      actorId: r.actor_id,
      actorRole: r.actor_role,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      beforeState: r.before_state,
      afterState: r.after_state,
      previousHash: r.previous_hash,
      currentHash: r.current_hash,
    }));

    if (blocks.length === 0) {
      return { valid: true, totalBlocks: 0 };
    }

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];

      // Check genesis or previous link
      if (i === 0) {
        // Genesis block
        if (
          b.previousHash !== '0' &&
          b.previousHash !== '0000000000000000000000000000000000000000000000000000000000000000'
        ) {
          return {
            valid: false,
            totalBlocks: blocks.length,
            tamperedBlockIndex: 0,
            reason: `Invalid genesis previous hash: ${b.previousHash}`,
          };
        }
      } else {
        const prevBlock = blocks[i - 1];
        if (b.previousHash !== prevBlock.currentHash) {
          return {
            valid: false,
            totalBlocks: blocks.length,
            tamperedBlockIndex: i,
            reason: `Broken chain link at block ${i}: expected previousHash ${prevBlock.currentHash}, found ${b.previousHash}`,
          };
        }
        // Index continuity
        if (b.index !== prevBlock.index + 1) {
          return {
            valid: false,
            totalBlocks: blocks.length,
            tamperedBlockIndex: i,
            reason: `Index gap at block ${i}: expected ${prevBlock.index + 1}, found ${b.index}`,
          };
        }
      }

      // FR-AUD-004/005: recompute content hash so payload tampering is detected,
      // not just broken links.
      const recomputed = computeBlockHash({
        index: b.index,
        timestamp: b.timestamp,
        actorId: b.actorId,
        actorRole: b.actorRole,
        entityType: b.entityType,
        entityId: b.entityId,
        action: b.action,
        // Ensure consistent serialization for hashing: null/undefined states should be '{}' if they represent empty JSON objects.
        beforeState: b.beforeState === null || b.beforeState === undefined ? '{}' : b.beforeState,
        afterState: b.afterState === null || b.afterState === undefined ? '{}' : b.afterState,
        previousHash: b.previousHash,
      });
      if (recomputed !== b.currentHash) {
        return {
          valid: false,
          totalBlocks: blocks.length,
          tamperedBlockIndex: i,
          reason: `Content tamper detected at block ${i} (index ${b.index})`,
        };
      }
    }

    return { valid: true, totalBlocks: blocks.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AuditService] verifyAuditChain error:', message);
    return { valid: false, totalBlocks: 0, reason: message };
  }
}
