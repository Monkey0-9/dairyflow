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
          SELECT tenant_id as "tenantId", "index" as "blockIndex",
                 timestamp, actor_id as "actorId", actor_role as "actorRole",
                 entity_type as "entityType", entity_id as "entityId",
                 action, before_state as "beforeState", after_state as "afterState",
                 previous_hash as "previousHash", current_hash as "currentHash"
          FROM audit_blocks WHERE 1=1`;
        if (entityType) {
          params.push(entityType);
          sql += ` AND entity_type = $${params.length}`;
        }
        sql += ` ORDER BY "index" DESC LIMIT 500`;
        const res = await query(sql, params);
        return NextResponse.json({ success: true, auditChain: res.rows, totalBlocks: res.rows.length, source: 'db' });
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
