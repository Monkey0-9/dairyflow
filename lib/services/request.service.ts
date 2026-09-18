import { query, transaction } from '../db';
import { appendAuditLog } from './audit.service';

export interface UnifiedRequest {
  id: string;
  type: 'PAUSE' | 'EXTRA_MILK' | 'QUANTITY_CHANGE';
  customerId: string;
  customerName: string;
  customerPhone?: string;
  farmerId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  details: string;
  createdAt: string;
  reviewedAt?: string | null;
  startDate?: string;
  endDate?: string;
  quantity?: number;
  newQuantity?: number;
  effectiveDate?: string;
}

/**
 * Fetch all unified requests for a farmer (or customer).
 */
export async function getUnifiedRequests(params: {
  farmerId?: string;
  customerId?: string;
  status?: string;
}): Promise<UnifiedRequest[]> {
  try {
    const list: UnifiedRequest[] = [];

    // 1. Pause Requests
    let pauseSql = `
      SELECT r.id, 'PAUSE' as type, r.customer_id as "customerId", r.farmer_id as "farmerId",
             r.start_date as "startDate", r.end_date as "endDate", r.reason,
             r.status, r.created_at as "createdAt", r.reviewed_at as "reviewedAt",
             u.name as "customerName", u.phone as "customerPhone"
      FROM pause_requests r
      JOIN customer_profiles c ON r.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const pauseParams: any[] = [];
    if (params.farmerId) {
      pauseParams.push(params.farmerId);
      pauseSql += ` AND r.farmer_id = $${pauseParams.length}`;
    }
    if (params.customerId) {
      pauseParams.push(params.customerId);
      pauseSql += ` AND r.customer_id = $${pauseParams.length}`;
    }
    if (params.status) {
      pauseParams.push(params.status);
      pauseSql += ` AND r.status = $${pauseParams.length}`;
    }
    pauseSql += ` ORDER BY r.created_at DESC`;

    const pauseRes = await query(pauseSql, pauseParams);
    for (const r of pauseRes.rows) {
      list.push({
        id: r.id,
        type: 'PAUSE',
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        farmerId: r.farmerId,
        status: r.status,
        details: `Vacation Pause from ${r.startDate} to ${r.endDate}: ${r.reason}`,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        startDate: r.startDate,
        endDate: r.endDate,
      });
    }

    // 2. Extra Milk Requests
    let extraSql = `
      SELECT r.id, 'EXTRA_MILK' as type, r.customer_id as "customerId", r.farmer_id as "farmerId",
             r.date, r.milk_type as "milkType", r.quantity::float as quantity, r.notes,
             r.status, r.created_at as "createdAt", r.reviewed_at as "reviewedAt",
             u.name as "customerName", u.phone as "customerPhone"
      FROM extra_milk_requests r
      JOIN customer_profiles c ON r.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const extraParams: any[] = [];
    if (params.farmerId) {
      extraParams.push(params.farmerId);
      extraSql += ` AND r.farmer_id = $${extraParams.length}`;
    }
    if (params.customerId) {
      extraParams.push(params.customerId);
      extraSql += ` AND r.customer_id = $${extraParams.length}`;
    }
    if (params.status) {
      extraParams.push(params.status);
      extraSql += ` AND r.status = $${extraParams.length}`;
    }
    extraSql += ` ORDER BY r.created_at DESC`;

    const extraRes = await query(extraSql, extraParams);
    for (const r of extraRes.rows) {
      list.push({
        id: r.id,
        type: 'EXTRA_MILK',
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        farmerId: r.farmerId,
        status: r.status,
        details: `Extra ${r.quantity}L ${r.milkType} milk on ${r.date}${r.notes ? ` (${r.notes})` : ''}`,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        quantity: r.quantity,
        startDate: r.date,
      });
    }

    // 3. Quantity Change Requests
    let qtySql = `
      SELECT r.id, 'QUANTITY_CHANGE' as type, r.customer_id as "customerId", r.farmer_id as "farmerId",
             r.effective_date as "effectiveDate", r.new_quantity::float as "newQuantity", r.reason,
             r.status, r.created_at as "createdAt", r.reviewed_at as "reviewedAt",
             u.name as "customerName", u.phone as "customerPhone"
      FROM quantity_change_requests r
      JOIN customer_profiles c ON r.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const qtyParams: any[] = [];
    if (params.farmerId) {
      qtyParams.push(params.farmerId);
      qtySql += ` AND r.farmer_id = $${qtyParams.length}`;
    }
    if (params.customerId) {
      qtyParams.push(params.customerId);
      qtySql += ` AND r.customer_id = $${qtyParams.length}`;
    }
    if (params.status) {
      qtyParams.push(params.status);
      qtySql += ` AND r.status = $${qtyParams.length}`;
    }
    qtySql += ` ORDER BY r.created_at DESC`;

    const qtyRes = await query(qtySql, qtyParams);
    for (const r of qtyRes.rows) {
      list.push({
        id: r.id,
        type: 'QUANTITY_CHANGE',
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        farmerId: r.farmerId,
        status: r.status,
        details: `Change daily quantity to ${r.newQuantity}L effective from ${r.effectiveDate}${r.reason ? ` (${r.reason})` : ''}`,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        newQuantity: r.newQuantity,
        effectiveDate: r.effectiveDate,
      });
    }

    // Sort combined list: PENDING first, then by date descending
    return list.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch (err) {
    console.error('[RequestService] getUnifiedRequests error:', err);
    return [];
  }
}

/**
 * Resolve tenant/farmer ownership for a customer profile.
 * Returns null when the customer profile cannot be found.
 */
async function resolveCustomerScope(customerId: string): Promise<{
  tenantId: string;
  farmerId: string;
} | null> {
  try {
    const res = await query(
      `SELECT tenant_id as "tenantId", farmer_id as "farmerId" FROM customer_profiles WHERE id = $1`,
      [customerId]
    );
    if (res.rows.length === 0) return null;
    return { tenantId: res.rows[0].tenantId, farmerId: res.rows[0].farmerId };
  } catch {
    return null;
  }
}

/**
 * Create a vacation pause request directly in PostgreSQL.
 * Used by POST /api/customer/pause-request (DB-first, transactional).
 */
export async function createPauseRequest(params: {
  customerId: string;
  farmerId?: string;
  tenantId?: string;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const scope = params.tenantId && params.farmerId
    ? { tenantId: params.tenantId, farmerId: params.farmerId }
    : await resolveCustomerScope(params.customerId);
  if (!scope) return { success: false, error: 'Customer not found' };
  try {
    const id = `PR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await query(
      `INSERT INTO pause_requests (id, tenant_id, customer_id, farmer_id, start_date, end_date, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')`,
      [id, scope.tenantId, params.customerId, params.farmerId || scope.farmerId, params.startDate, params.endDate, params.reason || 'Vacation Pause requested by customer']
    );
    return { success: true, id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create pause request';
    return { success: false, error: message };
  }
}

/**
 * Create a one-off extra milk request directly in PostgreSQL.
 * Used by POST /api/customer/milk-request (DB-first).
 */
export async function createExtraMilkRequest(params: {
  customerId: string;
  farmerId?: string;
  tenantId?: string;
  date: string;
  milkType?: string;
  quantity: number;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const scope = params.tenantId && params.farmerId
    ? { tenantId: params.tenantId, farmerId: params.farmerId }
    : await resolveCustomerScope(params.customerId);
  if (!scope) return { success: false, error: 'Customer not found' };
  try {
    const id = `EMR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await query(
      `INSERT INTO extra_milk_requests (id, tenant_id, customer_id, farmer_id, date, milk_type, quantity, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')`,
      [id, scope.tenantId, params.customerId, params.farmerId || scope.farmerId, params.date, params.milkType || 'Cow', params.quantity, params.notes || null]
    );
    return { success: true, id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create extra milk request';
    return { success: false, error: message };
  }
}

/**
 * Approve or reject a request by ID.
 * When approved, applies changes to delivery ledger or subscriptions inside a transaction.
 */
export async function handleRequestAction(
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  reviewer: { actorId: string; actorRole: string; tenantId: string; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  return transaction(async (client) => {
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    // 1. Check if Pause Request
    const pauseRes = await client.query(`SELECT * FROM pause_requests WHERE id = $1`, [requestId]);
    if (pauseRes.rows.length > 0) {
      const req = pauseRes.rows[0];
      await client.query(
        `UPDATE pause_requests SET status = $1, decision_notes = $2, reviewed_at = NOW() WHERE id = $3`,
        [newStatus, reviewer.notes || null, requestId]
      );

      if (action === 'APPROVE') {
        // Mark delivery records within date range as SKIPPED
        await client.query(
          `UPDATE delivery_records
           SET status = 'SKIPPED', delivered_quantity = 0.0, updated_at = NOW()
           WHERE customer_id = $1 AND date >= $2 AND date <= $3`,
          [req.customer_id, req.start_date, req.end_date]
        );
      }

      // Notify customer
      const custUserRes = await client.query(
        `SELECT user_id FROM customer_profiles WHERE id = $1`,
        [req.customer_id]
      );
      if (custUserRes.rows[0]) {
        await client.query(
          `INSERT INTO notifications (id, tenant_id, user_id, title, message, type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `NOTIF_${Date.now()}`,
            reviewer.tenantId,
            custUserRes.rows[0].user_id,
            `Vacation Request ${newStatus}`,
            `Your pause request for ${req.start_date} to ${req.end_date} has been ${newStatus.toLowerCase()}.`,
            action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
          ]
        );
      }

      return { success: true };
    }

    // 2. Check if Extra Milk Request
    const extraRes = await client.query(`SELECT * FROM extra_milk_requests WHERE id = $1`, [requestId]);
    if (extraRes.rows.length > 0) {
      const req = extraRes.rows[0];
      await client.query(
        `UPDATE extra_milk_requests SET status = $1, decision_notes = $2, reviewed_at = NOW() WHERE id = $3`,
        [newStatus, reviewer.notes || null, requestId]
      );

      if (action === 'APPROVE') {
        // Update delivery record on that date to add extra milk
        await client.query(
          `UPDATE delivery_records
           SET delivered_quantity = scheduled_quantity + $1, status = 'EXTRA', updated_at = NOW()
           WHERE customer_id = $2 AND date = $3`,
          [req.quantity, req.customer_id, req.date]
        );
      }

      // Notify customer
      const custUserRes = await client.query(
        `SELECT user_id FROM customer_profiles WHERE id = $1`,
        [req.customer_id]
      );
      if (custUserRes.rows[0]) {
        await client.query(
          `INSERT INTO notifications (id, tenant_id, user_id, title, message, type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `NOTIF_${Date.now()}`,
            reviewer.tenantId,
            custUserRes.rows[0].user_id,
            `Extra Milk Request ${newStatus}`,
            `Your extra milk request for ${req.quantity}L on ${req.date} has been ${newStatus.toLowerCase()}.`,
            action === 'APPROVE' ? 'SUCCESS' : 'WARNING',
          ]
        );
      }

      return { success: true };
    }

    // 3. Check if Quantity Change Request
    const qtyRes = await client.query(`SELECT * FROM quantity_change_requests WHERE id = $1`, [requestId]);
    if (qtyRes.rows.length > 0) {
      const req = qtyRes.rows[0];
      await client.query(
        `UPDATE quantity_change_requests SET status = $1, decision_notes = $2, reviewed_at = NOW() WHERE id = $3`,
        [newStatus, reviewer.notes || null, requestId]
      );

      if (action === 'APPROVE') {
        // Update customer profile daily quantity
        await client.query(
          `UPDATE customer_profiles SET daily_quantity = $1, updated_at = NOW() WHERE id = $2`,
          [req.new_quantity, req.customer_id]
        );
        // Update future delivery records
        await client.query(
          `UPDATE delivery_records
           SET scheduled_quantity = $1, updated_at = NOW()
           WHERE customer_id = $2 AND date >= $3 AND status = 'EXPECTED'`,
          [req.new_quantity, req.customer_id, req.effective_date]
        );
      }

      return { success: true };
    }

    return { success: false, error: 'Request not found with ID: ' + requestId };
  });
}
