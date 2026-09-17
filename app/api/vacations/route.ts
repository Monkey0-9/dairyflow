import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    let pauses = store.vacationPauses;
    let tempChanges = store.tempQuantityChanges;

    if (customerId) {
      pauses = pauses.filter((p) => p.customerId === customerId);
      tempChanges = tempChanges.filter((t) => t.customerId === customerId);
    }

    return NextResponse.json({
      success: true,
      vacationPauses: pauses,
      temporaryQuantityChanges: tempChanges,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, customerId, startDate, endDate, reason, overrideQuantity } = body;

    if (!customerId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'customerId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const store = getStore();

    if (type === 'PAUSE') {
      const pause = store.scheduleVacationPause(
        customerId,
        startDate,
        endDate,
        reason || 'Vacation / Out of town'
      );
      return NextResponse.json({ success: true, pause });
    } else if (type === 'EXTRA_QUANTITY') {
      if (overrideQuantity === undefined) {
        return NextResponse.json(
          { success: false, error: 'overrideQuantity is required for extra quantity' },
          { status: 400 }
        );
      }
      const change = store.scheduleTemporaryQuantity(
        customerId,
        startDate,
        endDate,
        parseFloat(overrideQuantity),
        reason || 'Guest demand'
      );
      return NextResponse.json({ success: true, change });
    }

    return NextResponse.json({ success: false, error: 'Invalid type. Use PAUSE or EXTRA_QUANTITY' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
