import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const todayIso = new Date().toISOString().split('T')[0];
    const date = searchParams.get('date') || todayIso;
    const customerId = searchParams.get('customerId');
    const store = getStore();

    // If customerId is provided, calculate customer consumption intelligence & anomaly detection
    if (customerId) {
      const records = Array.from(store.deliveryRecords.values())
        .filter((r) => r.customerId === customerId)
        .sort((a, b) => a.date.localeCompare(b.date));

      if (records.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No consumption records found for customer' },
          { status: 404 }
        );
      }

      let totalDelivered = 0;
      let deliveredDays = 0;
      let skippedDays = 0;
      let totalBillable = 0;

      for (const rec of records) {
        if (rec.status === 'DELIVERED' || rec.status === 'PARTIAL' || rec.status === 'EXTRA') {
          totalDelivered += rec.deliveredQuantity;
          deliveredDays++;
          totalBillable += rec.billableAmount;
        } else if (rec.status === 'SKIPPED' || rec.status === 'NOT_DELIVERED') {
          skippedDays++;
        }
      }

      const avgDaily = deliveredDays > 0 ? parseFloat((totalDelivered / deliveredDays).toFixed(2)) : 0;
      const todayRecord = records.find((r) => r.date === date);
      const todayQty = todayRecord ? todayRecord.deliveredQuantity : 0;

      // Anomaly Detection Logic
      let anomalyDetected = false;
      let anomalyReason: string | null = null;

      if (todayRecord) {
        if (todayQty > avgDaily * 2.2 && avgDaily > 0) {
          anomalyDetected = true;
          anomalyReason = `Unusual spike in daily consumption: ${todayQty}L vs baseline avg ${avgDaily}L`;
        } else if (todayRecord.status === 'NOT_DELIVERED' || (todayQty === 0 && todayRecord.status !== 'SKIPPED')) {
          anomalyDetected = true;
          anomalyReason = 'Unexplained missed delivery without pre-registered vacation';
        }
      }

      const extraMilkCount = store.extraMilkRequests.filter((e) => e.customerId === customerId).length;
      const pauseCount = store.pauseRequests.filter((p) => p.customerId === customerId).length;
      const disputeCount = store.disputes.filter((d) => {
        const dRec = store.deliveryRecords.get(d.deliveryRecordId);
        return dRec?.customerId === customerId;
      }).length;

      return NextResponse.json({
        success: true,
        customerId,
        summary: {
          totalDaysRecorded: records.length,
          deliveredDays,
          skippedDays,
          totalDeliveredLitres: parseFloat(totalDelivered.toFixed(1)),
          averageDailyLitres: avgDaily,
          totalSpent: parseFloat(totalBillable.toFixed(2)),
          extraRequestsCount: extraMilkCount,
          vacationsCount: pauseCount,
          disputesCount: disputeCount,
        },
        anomalyDetection: {
          anomalyDetected,
          anomalyReason,
          targetDate: date,
          todayDeliveredQuantity: todayQty,
          expectedBaseline: avgDaily,
        },
        recentHistory: records.slice(-7),
      });
    }

    // Default: Aggregate operational & month-to-date stats
    const stats = store.getAdminOperationalStats(date);

    let mtdExpected = 0;
    let mtdDelivered = 0;
    let mtdSkipped = 0;
    let mtdBillable = 0;
    let mtdRevenue = 0;

    const productBreakdown: Record<string, number> = { Cow: 0, Buffalo: 0, A2: 0 };
    const currentYearMonth = date.slice(0, 7);
    const parsedDate = new Date(date);
    const monthLabel = !isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : 'Current Month';

    for (const rec of store.deliveryRecords.values()) {
      if (rec.date.startsWith(currentYearMonth)) {
        mtdExpected += rec.scheduledQuantity;
        if (rec.status === 'DELIVERED' || rec.status === 'PARTIAL' || rec.status === 'EXTRA') {
          mtdDelivered += rec.deliveredQuantity;
          mtdBillable += rec.deliveredQuantity;
          mtdRevenue += rec.billableAmount;

          const prodName = rec.productId === 'p_buffalo' ? 'Buffalo' : rec.productId === 'p_a2' ? 'A2' : 'Cow';
          productBreakdown[prodName] = (productBreakdown[prodName] || 0) + rec.deliveredQuantity;
        } else if (rec.status === 'SKIPPED' || rec.status === 'NOT_DELIVERED') {
          mtdSkipped += rec.scheduledQuantity;
        }
      }
    }

    let mtdCollected = 0;
    for (const p of store.payments) {
      if (p.paidAt.startsWith(currentYearMonth) && p.status === 'SUCCESS') {
        mtdCollected += p.amount;
      }
    }

    const mtdOutstanding = Math.max(0, mtdRevenue - mtdCollected);

    return NextResponse.json({
      success: true,
      stats,
      monthToDate: {
        month: monthLabel,
        expectedLitres: parseFloat(mtdExpected.toFixed(1)),
        deliveredLitres: parseFloat(mtdDelivered.toFixed(1)),
        skippedLitres: parseFloat(mtdSkipped.toFixed(1)),
        billableLitres: parseFloat(mtdBillable.toFixed(1)),
        revenue: parseFloat(mtdRevenue.toFixed(2)),
        collected: parseFloat(mtdCollected.toFixed(2)),
        outstanding: parseFloat(mtdOutstanding.toFixed(2)),
        productBreakdown: {
          Cow: parseFloat(productBreakdown.Cow.toFixed(1)),
          Buffalo: parseFloat(productBreakdown.Buffalo.toFixed(1)),
          A2: parseFloat(productBreakdown.A2.toFixed(1)),
        },
      },
    });
  } catch (error: unknown) {
    console.error('[analytics/consumption] Calculation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to calculate analytics';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
