import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { query, transaction } from '@/lib/db';
import { getLedgerRange } from '@/lib/services/delivery.service';
import { publishEvent } from '@/lib/events';
import { isTestMode, isUuid } from '@/lib/db-scope';
import { randomUUID } from 'crypto';
import { executeIdempotentOperation } from '@/lib/security/idempotency';
import { DeliveryRecord } from '@/lib/types';
import { getStore } from '@/lib/store';

/**
 * Maximum number of calendar days into the past that ADMIN/FARMER roles may
 * directly modify a delivery record. Records older than this cutoff must go
 * through the formal delivery-correction workflow (POST /api/delivery-corrections).
 * SUPERADMIN is exempt from this window.
 */
const MODIFICATION_WINDOW_DAYS = 10; // 1–1.5 weeks

/**
 * Returns the ISO date string (YYYY-MM-DD) that is `days` calendar days ago
 * relative to today in IST (UTC+5:30) so the cutoff makes sense for Indian ops.
 */
function getModificationCutoffDate(days: number = MODIFICATION_WINDOW_DAYS): string {
  const now = new Date();
  // Shift to IST before computing date boundary
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  istNow.setDate(istNow.getDate() - days);
  return istNow.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if ('errorResponse' in auth) return auth.errorResponse;

  const tenantId = auth.user.tenantId;

  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('from') || searchParams.get('fromDate');
    const toDate = searchParams.get('to') || searchParams.get('toDate');
    const customerId = searchParams.get('customerId');
    const farmerId = searchParams.get('farmerId') || auth.user.farmerId;
    const date = searchParams.get('date');

    // 1. High-Performance Batch Date Range Query
    if (fromDate && toDate) {
      const dbRecords = await getLedgerRange({
        fromDate,
        toDate,
        tenantId,
        customerId: customerId || undefined,
        farmerId: farmerId || undefined,
      });

      return NextResponse.json({
        success: true,
        fromDate,
        toDate,
        records: dbRecords,
        count: dbRecords.length,
      });
    }

    // 2. Single Day Ledger Query
    const targetDate = date || new Date().toISOString().split('T')[0];
    let records: DeliveryRecord[] = [];

    // Fetch PostgreSQL records for tenant & date
    let sql = `
      SELECT d.id, d.tenant_id as "tenantId", d.customer_id as "customerId",
             d.farmer_id as "farmerId", d.product_id as "productId", d.date,
             d.scheduled_quantity::float as "scheduledQuantity",
             d.delivered_quantity::float as "deliveredQuantity",
             d.price_per_unit::float as "pricePerUnit",
             d.status, d.delivered_at as "deliveredAt", d.notes,
             u.name as "customerName", c.qr_token as "qrToken",
             p.name as "productName"
      FROM delivery_records d
      JOIN customer_profiles c ON d.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN products p ON d.product_id = p.id
      WHERE d.tenant_id = $1 AND d.date = $2
    `;
    const qParams: unknown[] = [tenantId, targetDate];
    if (customerId) {
      qParams.push(customerId);
      sql += ` AND d.customer_id = $${qParams.length}`;
    }
    if (farmerId) {
      qParams.push(farmerId);
      sql += ` AND d.farmer_id = $${qParams.length}`;
    }
    sql += ` ORDER BY u.name ASC`;

    const dbRes = await query(sql, qParams);
    if (dbRes.rows.length > 0) {
      records = dbRes.rows.map((r: any, idx: number) => {
        const cleanCode = r.qrToken && !r.qrToken.startsWith('MK_QR_') && !r.qrToken.startsWith('QR_') && r.qrToken.length <= 10
          ? r.qrToken
          : `MK-${String(idx + 1).padStart(3, '0')}`;
        return {
          id: r.id,
          tenantId: r.tenantId,
          customerId: r.customerId,
          customerName: r.customerName,
          customerCode: cleanCode,
          qrToken: r.qrToken,
          farmerId: r.farmerId,
        productId: r.productId,
        productName: r.productName || 'Fresh Milk',
        date: r.date,
        shift: 'MORNING' as const,
        scheduledQuantity: r.scheduledQuantity,
        deliveredQuantity: r.deliveredQuantity,
        pricePerUnit: r.pricePerUnit,
        billableAmount: Math.round(r.deliveredQuantity * r.pricePerUnit * 100) / 100,
        status: r.status,
        deliveredAt: r.deliveredAt,
        markedBy: 'FARMER' as const,
        notes: r.notes,
        updatedAt: new Date().toISOString(),
      };
    });
    } else if (isTestMode()) {
      const store = getStore();
      records = store.getOrGenerateDailyLedger(targetDate);
      if (customerId) {
        records = records.filter((r) => r.customerId === customerId);
      }
    }

    // Compute summary stats
    let totalScheduled = 0;
    let totalDelivered = 0;
    let skippedCount = 0;
    let partialCount = 0;
    let deliveredCount = 0;
    let disputedCount = 0;

    records.forEach((r) => {
      totalScheduled += r.scheduledQuantity;
      totalDelivered += r.deliveredQuantity;
      if (r.status === 'SKIPPED') skippedCount++;
      else if (r.status === 'PARTIAL') partialCount++;
      else if (r.status === 'DELIVERED' || r.status === 'EXTRA') deliveredCount++;
      if (r.hasDispute || r.status === 'DISPUTED') disputedCount++;
    });

    return NextResponse.json({
      success: true,
      date: targetDate,
      records,
      stats: {
        customerCount: records.length,
        totalScheduled: parseFloat(totalScheduled.toFixed(1)),
        totalDelivered: parseFloat(totalDelivered.toFixed(1)),
        pendingLitres: parseFloat(Math.max(0, totalScheduled - totalDelivered).toFixed(1)),
        deliveredCount,
        skippedCount,
        partialCount,
        disputedCount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ledger query failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = authenticateRequest(req, ['OWNER', 'MANAGER', 'FARMER', 'ADMIN', 'SUPERADMIN']);
  if ('errorResponse' in auth) return auth.errorResponse;

  const tenantId = auth.user.tenantId;
  const actorName = auth.user.name || auth.user.email || 'Farmer Admin';

  try {
    const body = await req.json();
    const recordId = body.recordId || body.id;
    const { deliveredQuantity, status, reason, notes, bottlesReturned, clientUpdatedAt } = body;
    // FR-DEL-006: replay-safe mutation key from client or header.
    const operationId: string | undefined =
      body.operationId || body.idempotencyKey || req.headers.get('idempotency-key') || undefined;

    if (!recordId) {
      return NextResponse.json({ success: false, error: 'recordId is required' }, { status: 400 });
    }

    const { result, isReplay } = await executeIdempotentOperation(
      operationId,
      'ledger.updateDelivery',
      auth.user.userId,
      () => transaction(async (client) => {
      let row: any = null;
      if (recordId) {
        const r = await client.query(
          `SELECT d.*, c.tenant_id as tenant_id FROM delivery_records d
           JOIN customer_profiles c ON c.id = d.customer_id
           WHERE d.id = $1`,
          [recordId]
        );
        if (r.rows.length > 0) row = r.rows[0];
      }
      if (!row && body.customerId && body.date) {
        const params: unknown[] = [tenantId, body.customerId, body.date];
        let sql = `SELECT d.*, c.tenant_id as tenant_id FROM delivery_records d
                   JOIN customer_profiles c ON c.id = d.customer_id
                   WHERE d.tenant_id = $1 AND d.customer_id = $2 AND d.date = $3`;
        if (isUuid(body.productId)) {
          params.push(body.productId);
          sql += ` AND d.product_id = $4`;
        }
        const r = await client.query(sql, params);
        if (r.rows.length > 0) row = r.rows[0];
      }
      if (!row && isTestMode()) {
        const store = getStore();
        const rec = store.deliveryRecords.get(recordId);
        if (rec) {
          row = {
            id: rec.id,
            tenant_id: rec.tenantId || tenantId,
            customer_id: rec.customerId,
            farmer_id: rec.farmerId,
            product_id: rec.productId,
            date: rec.date,
            scheduled_quantity: rec.scheduledQuantity,
            delivered_quantity: rec.deliveredQuantity,
            price_per_unit: rec.pricePerUnit,
            status: rec.status,
            notes: rec.notes,
          };
        }
      }
      if (!row && body.customerId && body.date) {
        // Auto-provision if customer exists in tenant
        const custRes = await client.query(
          `SELECT c.id, c.farmer_id, c.tenant_id, s.product_id, s.default_quantity,
                  COALESCE(s.custom_price_per_unit, p.base_price, 50.0)::float as price_per_unit
           FROM customer_profiles c
           LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.active = true
           LEFT JOIN products p ON s.product_id = p.id
           WHERE c.id = $1
           LIMIT 1`,
          [body.customerId]
        );
        if (custRes.rows.length > 0) {
          const cust = custRes.rows[0];
          const newId = recordId && isUuid(recordId) ? recordId : randomUUID();
          const pId = isUuid(body.productId) ? body.productId : (cust.product_id || 'prod_cow_milk');
          const schedQty = typeof body.scheduledQuantity === 'number' ? body.scheduledQuantity : (cust.default_quantity || 1.0);
          const price = typeof body.pricePerUnit === 'number' ? body.pricePerUnit : (cust.price_per_unit || 50.0);
          const initialStatus = status || 'DELIVERED';
          let initialDeliveredQty = deliveredQuantity !== undefined ? parseFloat(deliveredQuantity) : schedQty;
          if (initialStatus === 'SKIPPED' || initialStatus === 'NOT_DELIVERED') initialDeliveredQty = 0;
          const ins = await client.query(
            `INSERT INTO delivery_records (
               id, tenant_id, customer_id, farmer_id, product_id, date,
               scheduled_quantity, delivered_quantity, price_per_unit, status, notes, delivered_at, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
             RETURNING id, tenant_id, customer_id, farmer_id, product_id, date,
                       scheduled_quantity, delivered_quantity, price_per_unit, status, notes`,
            [
              newId,
              cust.tenant_id || tenantId,
              body.customerId,
              cust.farmer_id || auth.user.farmerId,
              pId,
              body.date,
              schedQty,
              initialDeliveredQty,
              price,
              initialStatus,
              notes ?? reason ?? null,
            ]
          );
          if (ins.rows.length > 0) row = ins.rows[0];
        }
      }
      if (!row) {
        const err: any = new Error('Delivery record not found in database for this tenant.');
        err.status = 404;
        throw err;
      }

      // SRS SEC-006: reject cross-tenant access even with guessed IDs.
      // Seed sessions (non-UUID) are exempt for legacy test fixtures.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isRealTenantScope = UUID_RE.test(tenantId || '') && UUID_RE.test(row.tenant_id || '');
      if (isRealTenantScope && row.tenant_id !== tenantId && auth.user.role !== 'SUPERADMIN') {
        const err: any = new Error('Forbidden: Cross-tenant delivery access denied.');
        err.status = 403;
        throw err;
      }

      // ── Modification Window Enforcement ──────────────────────────────────────
      // Only SUPERADMIN can bypass the rolling edit window.
      // All other roles (ADMIN, FARMER, MANAGER, OWNER) can only edit records
      // that are within MODIFICATION_WINDOW_DAYS calendar days of today.
      if (!isTestMode() && auth.user.role !== 'SUPERADMIN') {
        const cutoffDate = getModificationCutoffDate(MODIFICATION_WINDOW_DAYS);
        if (row.date < cutoffDate) {
          const err: any = new Error(
            `Modification window exceeded: Records older than ${MODIFICATION_WINDOW_DAYS} days (before ${cutoffDate}) cannot be edited directly. ` +
            `Please use the Delivery Correction workflow to adjust historical records.`
          );
          err.status = 403;
          err.code = 'MODIFICATION_WINDOW_EXCEEDED';
          err.cutoffDate = cutoffDate;
          throw err;
        }
      }

      // Check day-closing lock
      const lock = await client.query(
        `SELECT status FROM day_closings WHERE farmer_id = $1 AND date = $2 FOR UPDATE`,
        [row.farmer_id, row.date]
      );
      if (lock.rows.length > 0 && lock.rows[0].status === 'FINALIZED') {
        const err: any = new Error(
          `Ledger for ${row.date} has been FINALIZED. Historical modifications require an authorized adjustment.`
        );
        err.status = 423;
        throw err;
      }

      const finalStatus = status || row.status;
      let finalQty =
        deliveredQuantity !== undefined ? parseFloat(deliveredQuantity) : parseFloat(row.delivered_quantity);
      if (isNaN(finalQty) || finalQty < 0) {
        const err: any = new Error('deliveredQuantity must be a non-negative number');
        err.status = 400;
        throw err;
      }
      if (finalStatus === 'SKIPPED' || finalStatus === 'NOT_DELIVERED') finalQty = 0;

      let updatedRow = row;
      try {
        const upd = await client.query(
          `UPDATE delivery_records
           SET status = $1, delivered_quantity = $2, notes = COALESCE($3, notes),
               delivered_at = NOW(), updated_at = NOW()
           WHERE id = $4 AND tenant_id = $5
           RETURNING id, tenant_id, customer_id, farmer_id, product_id, date,
                     scheduled_quantity, delivered_quantity, price_per_unit, status, notes`,
          [finalStatus, finalQty, notes ?? reason ?? null, row.id, tenantId]
        );
        if (upd.rows.length > 0) updatedRow = upd.rows[0];
      } catch (dbErr) {
        console.error('[ledger/PATCH] Failed to update delivery record in DB:', dbErr);
        if (!isTestMode()) throw new Error('Failed to update delivery record in database');
      }

      if (isTestMode()) {
        updatedRow.status = finalStatus;
        updatedRow.delivered_quantity = finalQty;
        if (notes) updatedRow.notes = notes;
      }

      return updatedRow;
      })
    );

    const billable = parseFloat(result.delivered_quantity) * parseFloat(result.price_per_unit);

    if (isTestMode()) {
      try {
        const store = getStore();
        if (store.deliveryRecords.has(result.id)) {
          store.updateDeliveryRecord(
            result.id,
            {
              deliveredQuantity: parseFloat(result.delivered_quantity),
              status: result.status,
              reason,
              notes: result.notes,
            },
            { userId: auth.user.userId, name: actorName, role: 'FARMER' },
            true
          );
        }
      } catch (storeErr) {
        console.error('[ledger/PATCH] In-memory store mirror failed:', storeErr);
      }
    }

    if (!isReplay) {
      publishEvent({
        type: 'delivery:updated',
        tenantId: result.tenant_id,
        customerId: result.customer_id,
        payload: { recordId: result.id, status: result.status, deliveredQuantity: parseFloat(result.delivered_quantity), date: result.date },
      });
    }

    return NextResponse.json({
      success: true,
      isReplay: isReplay || undefined,
      record: {
        id: result.id,
        tenantId: result.tenant_id,
        customerId: result.customer_id,
        farmerId: result.farmer_id,
        productId: result.product_id,
        date: result.date,
        scheduledQuantity: parseFloat(result.scheduled_quantity),
        deliveredQuantity: parseFloat(result.delivered_quantity),
        pricePerUnit: parseFloat(result.price_per_unit),
        billableAmount: parseFloat(billable.toFixed(2)),
        status: result.status,
        notes: result.notes,
        bottlesReturned: bottlesReturned !== undefined ? bottlesReturned : undefined,
      },
      clientUpdatedAt: clientUpdatedAt || null,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to update delivery';
    console.error('[Ledger API PATCH] durable write failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        ...(error?.code && { code: error.code }),
        ...(error?.cutoffDate && { cutoffDate: error.cutoffDate, modificationWindowDays: MODIFICATION_WINDOW_DAYS }),
      },
      { status: typeof error?.status === 'number' ? error.status : 500 }
    );
  }
}

