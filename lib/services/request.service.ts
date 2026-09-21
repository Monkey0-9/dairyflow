import { query, transaction } from '../db';
import { isUuid } from '../db-scope';

const hasRealScope = (tenantId?: string, farmerId?: string): boolean =>
  isUuid(tenantId) && isUuid(farmerId);

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
  milkType?: string;
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
    const pauseParams: unknown[] = [];
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
    const extraParams: unknown[] = [];
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
        details: `Extra ${r.quantity}L ${r.milkType || 'Cow'} milk on ${r.date}${r.notes ? ` (${r.notes})` : ''}`,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        milkType: r.milkType || 'Cow',
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
    const qtyParams: unknown[] = [];
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
  const scope = hasRealScope(params.tenantId, params.farmerId)
    ? { tenantId: params.tenantId, farmerId: params.farmerId }
    : await resolveCustomerScope(params.customerId);
  if (!scope) return { success: false, error: 'Customer not found' };
  try {
    // NOTE: PKs are uuid() — never insert prefixed seed ids (PR_*) here;
    // Postgres rejects them and the request is silently lost.
    const res = await query<{ id: string }>(
      `INSERT INTO pause_requests (id, tenant_id, customer_id, farmer_id, start_date, end_date, reason, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id`,
      [scope.tenantId, params.customerId, params.farmerId || scope.farmerId, params.startDate, params.endDate, params.reason || 'Vacation Pause requested by customer']
    );
    return { success: true, id: res.rows[0].id };
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
  const scope = hasRealScope(params.tenantId, params.farmerId)
    ? { tenantId: params.tenantId, farmerId: params.farmerId }
    : await resolveCustomerScope(params.customerId);
  if (!scope) return { success: false, error: 'Customer not found' };
  try {
    // NOTE: PKs are uuid() — never insert prefixed seed ids (EMR_*) here.
    const res = await query<{ id: string }>(
      `INSERT INTO extra_milk_requests (id, tenant_id, customer_id, farmer_id, date, milk_type, quantity, notes, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING id`,
      [scope.tenantId, params.customerId, params.farmerId || scope.farmerId, params.date, params.milkType || 'Cow', params.quantity, params.notes || null]
    );
    return { success: true, id: res.rows[0].id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create extra milk request';
    return { success: false, error: message };
  }
}

/**
 * Create a permanent daily-quantity change request directly in PostgreSQL.
 * Used by POST /api/customer/quantity-request (DB-first).
 * Takes effect only after farmer approval (handleRequestAction).
 */
export async function createQuantityChangeRequest(params: {
  customerId: string;
  farmerId?: string;
  tenantId?: string;
  effectiveDate: string;
  newQuantity: number;
  reason?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const scope = hasRealScope(params.tenantId, params.farmerId)
    ? { tenantId: params.tenantId, farmerId: params.farmerId }
    : await resolveCustomerScope(params.customerId);
  if (!scope) return { success: false, error: 'Customer not found' };
  try {
    // NOTE: PKs are uuid() — never insert prefixed seed ids (QCR_*) here.
    const res = await query<{ id: string }>(
      `INSERT INTO quantity_change_requests (id, tenant_id, customer_id, farmer_id, effective_date, new_quantity, reason, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id`,
      [scope.tenantId, params.customerId, params.farmerId || scope.farmerId, params.effectiveDate, params.newQuantity, params.reason || null]
    );
    return { success: true, id: res.rows[0].id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create quantity change request';
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
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
          [
            req.tenant_id,
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
        const milkKind = req.milk_type || 'Cow';
        // 1. Try updating existing delivery record on that date
        const updRes = await client.query(
          `UPDATE delivery_records
           SET delivered_quantity = scheduled_quantity + $1, status = 'EXTRA', updated_at = NOW(),
               notes = COALESCE(notes, '') || ' + Extra ' || $1 || 'L ' || $4
           WHERE customer_id = $2 AND date = $3`,
          [req.quantity, req.customer_id, req.date, milkKind]
        );

        // 2. If no delivery record exists for that date yet, insert one so the extra milk is delivered
        if (updRes.rowCount === 0) {
          const prodRes = await client.query(
            `SELECT p.id, p.price_per_unit FROM products p
             WHERE p.tenant_id = $1 AND (p.code ILIKE '%' || $2 || '%' OR p.name ILIKE '%' || $2 || '%')
             ORDER BY p.is_active DESC LIMIT 1`,
            [req.tenant_id, milkKind]
          );
          const prodId = prodRes.rows[0]?.id || 'prod_cow_milk';
          const price = prodRes.rows[0]?.price_per_unit || 60.00;

          await client.query(
            `INSERT INTO delivery_records (
               id, tenant_id, customer_id, farmer_id, product_id, date,
               scheduled_quantity, delivered_quantity, price_per_unit, status, notes
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, $4, $5,
               0.0, $6, $7, 'EXTRA', $8
             ) ON CONFLICT (customer_id, date, product_id) DO UPDATE SET
               delivered_quantity = delivery_records.delivered_quantity + $6,
               status = 'EXTRA'`,
            [
              req.tenant_id,
              req.customer_id,
              req.farmer_id,
              prodId,
              req.date,
              req.quantity,
              price,
              `Approved Extra ${milkKind} Milk (${req.quantity}L)`
            ]
          );
        }
      }

      // Notify customer
      const custUserRes = await client.query(
        `SELECT user_id FROM customer_profiles WHERE id = $1`,
        [req.customer_id]
      );
      if (custUserRes.rows[0]) {
        const milkDisplay = req.milk_type || 'Cow';
        await client.query(
          `INSERT INTO notifications (id, tenant_id, user_id, title, message, type)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
          [
            req.tenant_id,
            custUserRes.rows[0].user_id,
            `Extra ${milkDisplay} Milk Request ${newStatus}`,
            `Your extra ${milkDisplay} milk request for ${req.quantity}L on ${req.date} has been ${newStatus.toLowerCase()}.`,
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
