import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { query } from '@/lib/db';
import { getLedgerRange } from '@/lib/services/delivery.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get('from') || searchParams.get('fromDate');
    const toDate = searchParams.get('to') || searchParams.get('toDate');
    const customerId = searchParams.get('customerId');
    const farmerId = searchParams.get('farmerId');
    const date = searchParams.get('date');

    const store = getStore();

    // 1. High-Performance Batch Date Range Query (Phase 22 Performance N+1 fix)
    if (fromDate && toDate) {
      try {
        const dbRecords = await getLedgerRange({
          fromDate,
          toDate,
          customerId: customerId || undefined,
          farmerId: farmerId || undefined,
        });

        if (dbRecords.length > 0) {
          return NextResponse.json({
            success: true,
            fromDate,
            toDate,
            records: dbRecords,
            count: dbRecords.length,
          });
        }
      } catch (err) {
        console.warn('[Ledger API] DB range query fallback to store:', err);
      }

      // In-memory fallback if DB empty/offline
      const allRecords = Array.from(store.deliveryRecords.values()).filter(
        (r) => r.date >= fromDate && r.date <= toDate
      );
      return NextResponse.json({
        success: true,
        fromDate,
        toDate,
        records: customerId ? allRecords.filter((r) => r.customerId === customerId) : allRecords,
        count: allRecords.length,
      });
    }

    // 2. Single Day Ledger Query (Backward compatibility)
    const targetDate = date || '2026-09-16';
    const records = store.getOrGenerateDailyLedger(targetDate);

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
  try {
    const body = await req.json();
    const { recordId, deliveredQuantity, status, reason, notes, bottlesReturned, changedBy } = body;

    if (!recordId) {
      return NextResponse.json({ success: false, error: 'recordId is required' }, { status: 400 });
    }

    const store = getStore();
    const actorObj =
      typeof changedBy === 'object' && changedBy !== null
        ? changedBy
        : {
            userId: 'user_farmer',
            name: typeof changedBy === 'string' ? changedBy : 'Farmer Suresh',
            role: 'FARMER' as const,
          };

    const updated = store.updateDeliveryRecord(
      recordId,
      {
        deliveredQuantity: deliveredQuantity !== undefined ? parseFloat(deliveredQuantity) : undefined,
        status,
        reason,
        notes,
        bottlesReturned,
      },
      actorObj
    );

    if (updated.error || !updated.record) {
      return NextResponse.json({ success: false, error: updated.error || 'Record not found' }, { status: 404 });
    }

    // Synchronize delivery record update to PostgreSQL if database is active
    try {
      await query(
        `UPDATE delivery_records
         SET delivered_quantity = $1, status = $2, notes = $3, delivered_at = NOW(), updated_at = NOW()
         WHERE id = $4 OR (customer_id = $5 AND date = $6)`,
        [
          updated.record.deliveredQuantity,
          updated.record.status,
          updated.record.notes || null,
          recordId,
          updated.record.customerId,
          updated.record.date,
        ]
      );
    } catch {
      // Non-blocking in isolated tests
    }

    return NextResponse.json({ success: true, record: updated.record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update delivery';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
