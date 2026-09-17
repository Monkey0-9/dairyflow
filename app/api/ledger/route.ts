import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || '2026-09-16';
    const store = getStore();
    const records = store.getOrGenerateDailyLedger(date);

    // Also compute summary stats for today/the requested date
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
      date,
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
    const actorObj = typeof changedBy === 'object' && changedBy !== null
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

    return NextResponse.json({ success: true, record: updated.record });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
