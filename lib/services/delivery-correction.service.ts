import { query, transaction } from '../db';
import { DeliveryStatus } from '../types';
import { appendAuditLog, AuditBlockRecord } from './audit.service';
import { publishEvent } from '../events';

export const AUTHORIZED_CORRECTION_ROLES = ['OWNER', 'MANAGER', 'FARMER', 'ADMIN', 'SUPERADMIN'];

export interface ApplyCorrectionParams {
  deliveryRecordId: string;
  correctedQuantity: number;
  correctedStatus?: DeliveryStatus;
  reason: string;
  authorizedBy: string;
  authorizedRole: string;
  tenantId: string;
}

export interface DeliveryCorrectionRecord {
  id: string;
  tenantId: string;
  deliveryRecordId: string;
  farmerId: string;
  customerId: string;
  date: string;
  originalQuantity: number;
  correctedQuantity: number;
  originalStatus: string;
  correctedStatus: string;
  reason: string;
  authorizedBy: string;
  authorizedRole: string;
  status: string;
  createdAt: string;
  appliedAt: string;
}

export interface CorrectionResult {
  success: boolean;
  correction?: DeliveryCorrectionRecord;
  auditBlock?: AuditBlockRecord;
  error?: string;
}

/**
 * Apply an explicit post-day-close delivery correction (SRS FR-DEL-009).
 * Requires authorization by OWNER, MANAGER, FARMER, ADMIN, or SUPERADMIN.
 * Updates the locked delivery record, reconciles day closing variance,
 * and appends an immutable SHA-256 block to the cryptographic audit chain.
 */
export async function applyDeliveryCorrection(
  params: ApplyCorrectionParams
): Promise<CorrectionResult> {
  const role = (params.authorizedRole || '').toUpperCase();
  if (!AUTHORIZED_CORRECTION_ROLES.includes(role)) {
    return {
      success: false,
      error: 'Unauthorized: Post-day-close corrections require an authorized role (OWNER, MANAGER, FARMER, ADMIN).',
    };
  }

  if (params.correctedQuantity === undefined || params.correctedQuantity === null || isNaN(params.correctedQuantity) || params.correctedQuantity < 0) {
    return {
      success: false,
      error: 'Invalid correctedQuantity: must be a non-negative number.',
    };
  }

  const cleanReason = (params.reason || '').trim();
  if (!cleanReason || cleanReason.length < 5) {
    return {
      success: false,
      error: 'A detailed reason/justification (minimum 5 characters) is required for post-close corrections.',
    };
  }

  try {
    return await transaction(async (client) => {
      // 1. Lock and load target delivery record
      const delRes = await client.query(
        `SELECT id, tenant_id, customer_id, farmer_id, date, status,
                scheduled_quantity::float as scheduled_quantity,
                delivered_quantity::float as delivered_quantity,
                price_per_unit::float as price_per_unit, notes
         FROM delivery_records
         WHERE id = $1
         FOR UPDATE`,
        [params.deliveryRecordId]
      );

      if (delRes.rows.length === 0) {
        return { success: false, error: 'Delivery record not found.' };
      }

      const delivery = delRes.rows[0];
      const origQty = parseFloat(delivery.delivered_quantity) || 0;
      const origStatus = delivery.status;
      const newQty = Number(params.correctedQuantity);
      const newStatus = params.correctedStatus || (newQty > 0 ? 'DELIVERED' : 'SKIPPED');

      // 2. Lock day closing record if present
      const closingRes = await client.query(
        `SELECT id, status, total_delivered::float as total_delivered, variance::float as variance
         FROM day_closings
         WHERE farmer_id = $1 AND date = $2
         FOR UPDATE`,
        [delivery.farmer_id, delivery.date]
      );

      const correctionId = `corr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const nowIso = new Date().toISOString();

      // 3. Record in delivery_corrections table
      await client.query(
        `INSERT INTO delivery_corrections (
           id, tenant_id, delivery_record_id, farmer_id, customer_id, date,
           original_quantity, corrected_quantity, original_status, corrected_status,
           reason, authorized_by, authorized_role, status, created_at, applied_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'APPLIED', NOW(), NOW())`,
        [
          correctionId,
          params.tenantId || delivery.tenant_id,
          delivery.id,
          delivery.farmer_id,
          delivery.customer_id,
          delivery.date,
          origQty,
          newQty,
          origStatus,
          newStatus,
          cleanReason,
          params.authorizedBy,
          role,
        ]
      );

      // 4. Update the delivery record
      const auditNote = ` [Corrected: ${origQty}L -> ${newQty}L (${newStatus}) by ${role} ${params.authorizedBy}: ${cleanReason}]`;
      await client.query(
        `UPDATE delivery_records
         SET delivered_quantity = $1, status = $2, notes = COALESCE(notes, '') || $3
         WHERE id = $4`,
        [newQty, newStatus, auditNote, delivery.id]
      );

      // 5. Reconcile day closing delivered litres and variance if day was locked
      const delta = newQty - origQty;
      if (closingRes.rows.length > 0 && Math.abs(delta) > 0.0001) {
        await client.query(
          `UPDATE day_closings
           SET total_delivered = total_delivered + $1,
               variance = variance - $1
           WHERE farmer_id = $2 AND date = $3`,
          [delta, delivery.farmer_id, delivery.date]
        );
      }

      // 6. Append to cryptographic SHA-256 audit blockchain (audit_blocks)
      const auditBlock = await appendAuditLog({
        tenantId: params.tenantId || delivery.tenant_id,
        actorId: params.authorizedBy,
        actorRole: role,
        entityType: 'DELIVERY_RECORD',
        entityId: delivery.id,
        action: 'DELIVERY_CORRECTION',
        beforeState: {
          deliveredQuantity: origQty,
          status: origStatus,
          date: delivery.date,
          customerId: delivery.customer_id,
        },
        afterState: {
          deliveredQuantity: newQty,
          status: newStatus,
          delta,
          correctionId,
          reason: cleanReason,
        },
      });

      // 7. Publish live event
      publishEvent({
        type: 'delivery:updated',
        tenantId: params.tenantId || delivery.tenant_id,
        farmerId: delivery.farmer_id,
        customerId: delivery.customer_id,
        payload: {
          correctionId,
          deliveryRecordId: delivery.id,
          date: delivery.date,
          originalQuantity: origQty,
          correctedQuantity: newQty,
          status: newStatus,
          reason: cleanReason,
        },
      });

      const correction: DeliveryCorrectionRecord = {
        id: correctionId,
        tenantId: params.tenantId || delivery.tenant_id,
        deliveryRecordId: delivery.id,
        farmerId: delivery.farmer_id,
        customerId: delivery.customer_id,
        date: delivery.date,
        originalQuantity: origQty,
        correctedQuantity: newQty,
        originalStatus: origStatus,
        correctedStatus: newStatus,
        reason: cleanReason,
        authorizedBy: params.authorizedBy,
        authorizedRole: role,
        status: 'APPLIED',
        createdAt: nowIso,
        appliedAt: nowIso,
      };

      return {
        success: true,
        correction,
        auditBlock,
      };
    });
  } catch (err) {
    console.error('[delivery-correction] Transaction failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to apply delivery correction',
    };
  }
}

/**
 * Retrieve delivery corrections for audit/reporting purposes.
 */
export async function getDeliveryCorrections(filters: {
  tenantId?: string;
  farmerId?: string;
  customerId?: string;
  date?: string;
  limit?: number;
}): Promise<DeliveryCorrectionRecord[]> {
  try {
    const params: unknown[] = [];
    let sql = `
      SELECT id, tenant_id as "tenantId", delivery_record_id as "deliveryRecordId",
             farmer_id as "farmerId", customer_id as "customerId", date,
             original_quantity::float as "originalQuantity",
             corrected_quantity::float as "correctedQuantity",
             original_status as "originalStatus",
             corrected_status as "correctedStatus",
             reason, authorized_by as "authorizedBy", authorized_role as "authorizedRole",
             status, created_at as "createdAt", applied_at as "appliedAt"
      FROM delivery_corrections
      WHERE 1=1
    `;

    if (filters.tenantId) {
      params.push(filters.tenantId);
      sql += ` AND tenant_id = $${params.length}`;
    }
    if (filters.farmerId) {
      params.push(filters.farmerId);
      sql += ` AND farmer_id = $${params.length}`;
    }
    if (filters.customerId) {
      params.push(filters.customerId);
      sql += ` AND customer_id = $${params.length}`;
    }
    if (filters.date) {
      params.push(filters.date);
      sql += ` AND date = $${params.length}`;
    }

    params.push(filters.limit || 100);
    sql += ` ORDER BY applied_at DESC LIMIT $${params.length}`;

    const res = await query<DeliveryCorrectionRecord>(sql, params);
    return res.rows;
  } catch (err) {
    console.error('[getDeliveryCorrections] Query failed:', err);
    return [];
  }
}
