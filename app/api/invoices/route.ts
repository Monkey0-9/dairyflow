import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : 9;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : 2026;

    let list = store.invoices;

    if (customerId) {
      list = list.filter((i) => i.customerId === customerId);
    }
    if (month && year) {
      list = list.filter((i) => i.month === month && i.year === year);
    }

    // Summary calculations
    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalLitres = 0;

    list.forEach((i) => {
      totalBilled += i.totalAmount;
      totalCollected += i.paidAmount;
      totalOutstanding += i.outstandingAmount;
      totalLitres += i.totalQuantity;
    });

    return NextResponse.json({
      success: true,
      invoices: list,
      summary: {
        totalBilled: parseFloat(totalBilled.toFixed(2)),
        totalCollected: parseFloat(totalCollected.toFixed(2)),
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
        totalLitres: parseFloat(totalLitres.toFixed(1)),
        count: list.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();
    const month = body.month || 9;
    const year = body.year || 2026;
    const customerId = body.customerId;

    if (customerId) {
      const inv = store.recalculateMonthlyInvoice(customerId, month, year);
      return NextResponse.json({ success: true, invoice: inv });
    }

    // Recalculate for ALL customers
    const updatedInvoices = [];
    for (const cust of store.customers) {
      const inv = store.recalculateMonthlyInvoice(cust.id, month, year);
      if (inv) updatedInvoices.push(inv);
    }

    return NextResponse.json({ success: true, invoices: updatedInvoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
