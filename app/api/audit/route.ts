import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { query } from '@/lib/db';
import { isTestMode } from '@/lib/db-scope';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');

    // Production: durable read from the audit_blocks blockchain table.
    if (!isTestMode()) {
      try {
        const params: unknown[] = [];
        let sql = `
          SELECT b.tenant_id as "tenantId", b."index" as "blockIndex",
                 b.timestamp, b.actor_id as "actorId", b.actor_role as "actorRole",
                 b.entity_type as "entityType", b.entity_id as "entityId",
                 b.action, b.before_state as "beforeState", b.after_state as "afterState",
                 b.previous_hash as "previousHash", b.current_hash as "currentHash",
                 u.name as "actorName"
          FROM audit_blocks b LEFT JOIN users u ON u.id = b.actor_id WHERE 1=1`;
        if (entityType) {
          params.push(entityType);
          sql += ` AND b.entity_type = $${params.length}`;
        }
        sql += ` ORDER BY b."index" DESC LIMIT 500`;
        const res = await query(sql, params);
        // Shape DB rows into the CryptographicAuditBlock contract the viewer
        // expects. Actor name falls back to the stored actor id (e.g. SYSTEM
        // or a user removed during data hygiene) so rendering never crashes.
        const safeJson = (v: unknown) => {
          if (!v) return undefined;
          if (typeof v === 'object') return v as Record<string, unknown>;
          try { return JSON.parse(String(v)); } catch { return undefined; }
        };
        const auditChain = res.rows.map((r: Record<string, unknown>) => ({
          blockIndex: r.blockIndex,
          timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
          entityType: r.entityType,
          entityId: r.entityId,
          tenantId: r.tenantId,
          actor: {
            userId: r.actorId,
            name: (r.actorName as string) || (r.actorId as string) || 'System',
            role: r.actorRole,
            ipAddress: '127.0.0.1',
          },
          action: r.action,
          beforeState: safeJson(r.beforeState),
          afterState: safeJson(r.afterState) || {},
          previousHash: r.previousHash,
          currentHash: r.currentHash,
        }));
        return NextResponse.json({ success: true, auditChain, totalBlocks: auditChain.length, source: 'db' });
      } catch (err) {
        console.error('[audit] DB read failed:', err);
        return NextResponse.json({ success: false, error: 'Failed to load audit trail' }, { status: 500 });
      }
    }

    const store = getStore();

    let chain = store.auditChain;
    if (entityType) {
      chain = chain.filter((b) => b.entityType === entityType);
    }

    return NextResponse.json({
      success: true,
      auditChain: chain,
      totalBlocks: store.auditChain.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit chain';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
