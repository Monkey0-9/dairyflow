import { query, transaction } from '../db';

export interface DbDispute {
  id: string;
  tenantId: string;
  customerId: string;
  farmerId: string;
  deliveryId?: string | null;
  date: string;
  issueType: string;
  claimedQuantity?: number | null;
  status: string;
  customerNotes: string;
  resolutionNotes?: string | null;
  adjustedAmount?: number | null;
}

/**
 * List disputes from PostgreSQL with optional filters.
 */
export async function listDisputes(params: {
  customerId?: string;
  farmerId?: string;
  tenantId?: string;
  status?: string;
}): Promise<DbDispute[]> {
  let sql = `
    SELECT id, tenant_id as "tenantId", customer_id as "customerId",
           farmer_id as "farmerId", delivery_id as "deliveryId", date,
           issue_type as "issueType", claimed_quantity::float as "claimedQuantity",
           status, customer_notes as "customerNotes",
           resolution_notes as "resolutionNotes",
           adjusted_amount::float as "adjustedAmount"
    FROM disputes WHERE 1=1
  `;
  const values: unknown[] = [];
  if (params.customerId) {
    values.push(params.customerId);
    sql += ` AND customer_id = $${values.length}`;
  }
  if (params.farmerId) {
    values.push(params.farmerId);
    sql += ` AND farmer_id = $${values.length}`;
  }
  if (params.tenantId) {
    values.push(params.tenantId);
    sql += ` AND tenant_id = $${values.length}`;
  }
  if (params.status) {
    values.push(params.status);
    sql += ` AND status = $${values.length}`;
  }
  sql += ` ORDER BY created_at DESC`;
  const res = await query<DbDispute>(sql, values);
  return res.rows;
}

/**
 * Create a dispute directly in PostgreSQL.
 * Preserves price-locking: never mutates delivery_records on creation.
 */
export async function createDispute(params: {
  customerId: string;
  farmerId?: string;
  tenantId?: string;
  deliveryId?: string;
  date: string;
  issueType?: string;
  claimedQuantity?: number;
  customerNotes: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    let tenantId = params.tenantId;
    let farmerId = params.farmerId;
    if (!tenantId || !farmerId) {
      const scope = await query(
        `SELECT tenant_id as "tenantId", farmer_id as "farmerId" FROM customer_profiles WHERE id = $1`,
        [params.customerId]
      );
      if (scope.rows.length === 0) return { success: false, error: 'Customer not found' };
      tenantId = tenantId || scope.rows[0].tenantId;
      farmerId = farmerId || scope.rows[0].farmerId;
    }
    // Resolve date from delivery record when only deliveryId is supplied
    let date = params.date;
    if (!date && params.deliveryId) {
      const del = await query(`SELECT date FROM delivery_records WHERE id = $1`, [params.deliveryId]);
      if (del.rows.length === 0) return { success: false, error: 'Delivery record not found' };
      date = del.rows[0].date;
    }
    if (!date) return { success: false, error: 'date is required' };
    const id = `DISP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await query(
      `INSERT INTO disputes (id, tenant_id, customer_id, farmer_id, delivery_id, date, issue_type, claimed_quantity, status, customer_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9)`,
      [id, tenantId, params.customerId, farmerId, params.deliveryId || null, date, params.issueType || 'NOT_DELIVERED', params.claimedQuantity ?? null, params.customerNotes]
    );
    return { success: true, id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create dispute';
    return { success: false, error: message };
  }
}

/**
 * Resolve a dispute transactionally.
 * ACCEPT  -> sets delivery status from claimed quantity (price per unit locked, amount derived).
 * REJECT  -> marks dispute REJECTED without touching the ledger.
 * ADJUST  -> applies custom quantity settlement.
 */
export async function resolveDispute(params: {
  disputeId: string;
  action: 'ACCEPT' | 'REJECT' | 'ADJUST' | 'RESOLVE' | 'RESOLVED' | 'APPROVED';
  customQuantity?: number;
  farmerNote?: string;
}): Promise<{ success: boolean; error?: string }> {
  return transaction(async (client) => {
    const disp = await client.query(`SELECT * FROM disputes WHERE id = $1`, [params.disputeId]);
    if (disp.rows.length === 0) return { success: false, error: 'Dispute not found' };
    const d = disp.rows[0];
    const note = params.farmerNote || null;

    if (params.action === 'REJECT') {
      await client.query(
        `UPDATE disputes SET status = 'REJECTED', resolution_notes = $1, resolved_at = NOW() WHERE id = $2`,
        [note, params.disputeId]
      );
      return { success: true };
    }

    // ACCEPT / RESOLVE / ADJUST paths mutate ledger with price-lock preserved
    const settledQty =
      params.customQuantity ?? (d.claimed_quantity !== null ? Number(d.claimed_quantity) : null);
    await client.query(
      `UPDATE disputes SET status = 'RESOLVED', resolution_notes = $1, adjusted_amount = $2, resolved_at = NOW() WHERE id = $3`,
      [note, null, params.disputeId]
    );
    if (d.delivery_id && settledQty !== null) {
      // Fetch locked unit price, derive billable amount implicitly via delivered_quantity
      await client.query(
        `UPDATE delivery_records SET delivered_quantity = $1, status = CASE WHEN $1 = 0 THEN 'SKIPPED' WHEN $1 < scheduled_quantity THEN 'PARTIAL' ELSE 'DELIVERED' END, notes = $2, updated_at = NOW() WHERE id = $3`,
        [settledQty, note || 'Dispute settlement', d.delivery_id]
      );
    } else if (d.delivery_id) {
      await client.query(`UPDATE delivery_records SET notes = $1, updated_at = NOW() WHERE id = $2`, [
        note || 'Dispute reviewed',
        d.delivery_id,
      ]);
    }
    return { success: true };
  });
}
