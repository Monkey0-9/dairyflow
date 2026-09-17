import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || '2026-09-16';
    const store = getStore();

    const stats = store.getAdminOperationalStats(date);

    // Also calculate month-to-date totals (September 2026)
    let mtdExpected = 0;
    let mtdDelivered = 0;
    let mtdSkipped = 0;
    let mtdBillable = 0;
    let mtdRevenue = 0;

    for (const rec of store.deliveryRecords.values()) {
      if (rec.date.startsWith('2026-09')) {
        mtdExpected += rec.scheduledQuantity;
        if (rec.status === 'DELIVERED' || rec.status === 'PARTIAL' || rec.status === 'EXTRA') {
          mtdDelivered += rec.deliveredQuantity;
          mtdBillable += rec.deliveredQuantity;
          mtdRevenue += rec.billableAmount;
        } else if (rec.status === 'SKIPPED' || rec.status === 'NOT_DELIVERED') {
          mtdSkipped += rec.scheduledQuantity;
        }
      }
    }

    let mtdCollected = 0;
    for (const p of store.payments) {
      if (p.paidAt.startsWith('2026-09') && p.status === 'SUCCESS') {
        mtdCollected += p.amount;
      }
    }

    const mtdOutstanding = Math.max(0, mtdRevenue - mtdCollected);

    return NextResponse.json({
      success: true,
      stats,
      monthToDate: {
        month: 'September 2026',
        expectedLitres: parseFloat(mtdExpected.toFixed(1)),
        deliveredLitres: parseFloat(mtdDelivered.toFixed(1)),
        skippedLitres: parseFloat(mtdSkipped.toFixed(1)),
        billableLitres: parseFloat(mtdBillable.toFixed(1)),
        revenue: parseFloat(mtdRevenue.toFixed(2)),
        collected: parseFloat(mtdCollected.toFixed(2)),
        outstanding: parseFloat(mtdOutstanding.toFixed(2)),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to calculate analytics';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
