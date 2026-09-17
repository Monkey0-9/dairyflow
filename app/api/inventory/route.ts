import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || '2026-09-16';
    const store = getStore();

    let rec = store.inventoryReconciliations.get(date);
    const dayRecords = store.getOrGenerateDailyLedger(date);

    let totalDelivered = 0;
    dayRecords.forEach((r) => {
      totalDelivered += r.deliveredQuantity;
    });

    if (!rec) {
      rec = {
        date,
        tenantId: store.tenantId,
        cowMilkProduced: 55.0,
        buffaloMilkProduced: 22.0,
        a2MilkProduced: 8.0,
        totalProduced: 85.0,
        totalDelivered: parseFloat(totalDelivered.toFixed(1)),
        remainingStock: parseFloat(Math.max(0, 85.0 - totalDelivered - 2.0).toFixed(1)),
        wasteOrSpillage: 1.0,
        personalConsumption: 1.0,
        discrepancy: 0.0,
        closedAt: '',
        closedBy: '',
        status: 'BALANCED',
      };
    } else {
      rec.totalDelivered = parseFloat(totalDelivered.toFixed(1));
    }

    const dayLockStatus = store.dayLockStatusMap.get(date) || 'OPEN';

    return NextResponse.json({
      success: true,
      reconciliation: rec,
      dayLockStatus,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      date,
      cowMilkProduced,
      buffaloMilkProduced,
      a2MilkProduced,
      wasteOrSpillage,
      personalConsumption,
      remainingStock,
      closedByName,
    } = body;

    if (!date) {
      return NextResponse.json({ success: false, error: 'date is required' }, { status: 400 });
    }

    const store = getStore();
    const result = store.closeDay(
      date,
      {
        cowMilkProduced: parseFloat(cowMilkProduced || 0),
        buffaloMilkProduced: parseFloat(buffaloMilkProduced || 0),
        a2MilkProduced: parseFloat(a2MilkProduced || 0),
        wasteOrSpillage: parseFloat(wasteOrSpillage || 0),
        personalConsumption: parseFloat(personalConsumption || 0),
        remainingStock: parseFloat(remainingStock || 0),
      },
      {
        userId: 'user_farmer',
        name: closedByName || 'Suresh Patel (Farmer)',
        role: 'FARMER',
      }
    );

    return NextResponse.json({ success: true, reconciliation: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
