import { query } from '../db';
import { DeliveryStatus } from '../types';

export interface LedgerQueryParams {
  farmerId?: string;
  customerId?: string;
  tenantId?: string;
  fromDate: string;
  toDate: string;
}

export interface DbDeliveryRecord {
  id: string;
  tenantId: string;
  customerId: string;
  farmerId: string;
  productId: string;
  date: string;
  scheduledQuantity: number;
  deliveredQuantity: number;
  pricePerUnit: number;
  status: DeliveryStatus;
  deliveredAt?: string | null;
  notes?: string | null;
  customerName?: string;
  productName?: string;
}

/**
 * High-performance batch ledger query.
 * Solves N+1 round trips by fetching an entire date range in a single indexed query.
 */
export async function getLedgerRange(params: LedgerQueryParams): Promise<DbDeliveryRecord[]> {
  try {
    let sql = `
      SELECT d.id, d.tenant_id as "tenantId", d.customer_id as "customerId",
             d.farmer_id as "farmerId", d.product_id as "productId", d.date,
             d.scheduled_quantity::float as "scheduledQuantity",
             d.delivered_quantity::float as "deliveredQuantity",
             d.price_per_unit::float as "pricePerUnit",
             d.status, d.delivered_at as "deliveredAt", d.notes,
             u.name as "customerName", p.name as "productName"
      FROM delivery_records d
      JOIN customer_profiles c ON d.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN products p ON d.product_id = p.id
      WHERE d.date >= $1 AND d.date <= $2
    `;
    const queryParams: unknown[] = [params.fromDate, params.toDate];

    if (params.farmerId) {
      queryParams.push(params.farmerId);
      sql += ` AND d.farmer_id = $${queryParams.length}`;
    }
    if (params.customerId) {
      queryParams.push(params.customerId);
      sql += ` AND d.customer_id = $${queryParams.length}`;
    }
    if (params.tenantId) {
      queryParams.push(params.tenantId);
      sql += ` AND d.tenant_id = $${queryParams.length}`;
    }

    sql += ` ORDER BY d.date ASC, u.name ASC`;

    const res = await query<DbDeliveryRecord>(sql, queryParams);
    return res.rows;
  } catch (err) {
    console.error('[DeliveryService] getLedgerRange error:', err);
    return [];
  }
}

/**
 * Check if a given date is locked by day closing.
 */
export async function isDateLocked(farmerId: string, date: string): Promise<boolean> {
  try {
    const res = await query(
      `SELECT status FROM day_closings WHERE farmer_id = $1 AND date = $2`,
      [farmerId, date]
    );
    if (res.rows.length > 0 && res.rows[0].status === 'FINALIZED') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  EXPECTED: ['DELIVERED', 'PARTIAL', 'SKIPPED', 'NOT_DELIVERED', 'EXTRA', 'DISPUTED'],
  DELIVERED: ['PARTIAL', 'SKIPPED', 'EXTRA', 'DISPUTED'],
  PARTIAL: ['DELIVERED', 'SKIPPED', 'EXTRA', 'DISPUTED'],
  SKIPPED: ['DELIVERED', 'PARTIAL', 'DISPUTED'],
  NOT_DELIVERED: ['DELIVERED', 'PARTIAL', 'SKIPPED', 'DISPUTED'],
  EXTRA: ['DELIVERED', 'PARTIAL', 'DISPUTED'],
  DISPUTED: ['DELIVERED', 'PARTIAL', 'SKIPPED', 'NOT_DELIVERED'],
};

/**
 * Record or update a delivery.
 * Enforces legal state transitions, price locking, and day closing invariants.
 */
export async function updateDeliveryStatus(params: {
  deliveryId?: string;
  customerId: string;
  farmerId: string;
  date: string;
  status: DeliveryStatus;
  deliveredQuantity: number;
  notes?: string;
  bottlesReturned?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Transactional isolation lock checking against day_closings (SELECT ... FOR UPDATE)
    await query('BEGIN');

    const lockCheck = await query(
      `SELECT status FROM day_closings WHERE farmer_id = $1 AND date = $2 FOR UPDATE`,
      [params.farmerId, params.date]
    );

    if (lockCheck.rows.length > 0 && lockCheck.rows[0].status === 'FINALIZED') {
      await query('ROLLBACK');
      return { success: false, error: 'Cannot modify delivery: Day has been finalized and locked.' };
    }

    // Check existing record for FSM validation
    let currentRecord: { id: string; status: DeliveryStatus; scheduled_quantity: number } | null = null;
    if (params.deliveryId) {
      const res = await query(
        `SELECT id, status, scheduled_quantity::float as scheduled_quantity FROM delivery_records WHERE id = $1 FOR UPDATE`,
        [params.deliveryId]
      );
      if (res.rows.length > 0) currentRecord = res.rows[0] as unknown as { id: string; status: DeliveryStatus; scheduled_quantity: number };
    } else {
      const res = await query(
        `SELECT id, status, scheduled_quantity::float as scheduled_quantity FROM delivery_records WHERE customer_id = $1 AND date = $2 FOR UPDATE`,
        [params.customerId, params.date]
      );
      if (res.rows.length > 0) currentRecord = res.rows[0] as unknown as { id: string; status: DeliveryStatus; scheduled_quantity: number };
    }

    if (currentRecord && currentRecord.status !== params.status) {
      const allowed = VALID_TRANSITIONS[currentRecord.status] || [];
      if (!allowed.includes(params.status)) {
        await query('ROLLBACK');
        return {
          success: false,
          error: `Illegal state transition from ${currentRecord.status} to ${params.status}`,
        };
      }
    }

    // Quantity invariants: SKIPPED and NOT_DELIVERED must have 0.0 delivered quantity
    let finalQty = params.deliveredQuantity;
    if (params.status === 'SKIPPED' || params.status === 'NOT_DELIVERED') {
      finalQty = 0.0;
    }

    const bottles = typeof params.bottlesReturned === 'number' ? params.bottlesReturned : 0;

    if (params.deliveryId) {
      await query(
        `UPDATE delivery_records
         SET status = $1, delivered_quantity = $2, notes = $3, bottles_returned = $4, delivered_at = NOW(), updated_at = NOW()
         WHERE id = $5`,
        [params.status, finalQty, params.notes || null, bottles, params.deliveryId]
      );
    } else {
      await query(
        `UPDATE delivery_records
         SET status = $1, delivered_quantity = $2, notes = $3, bottles_returned = $4, delivered_at = NOW(), updated_at = NOW()
         WHERE customer_id = $5 AND date = $6`,
        [params.status, finalQty, params.notes || null, bottles, params.customerId, params.date]
      );
    }

    await query('COMMIT');
    return { success: true };
  } catch (err: unknown) {
    await query('ROLLBACK').catch(() => {});
    const message = err instanceof Error ? err.message : 'Failed to update delivery';
    console.error('[DeliveryService] updateDeliveryStatus error:', err);
    return { success: false, error: message };
  }
}
