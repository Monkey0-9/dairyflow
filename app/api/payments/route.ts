import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    let list = store.payments;
    if (customerId) {
      list = list.filter((p) => p.customerId === customerId);
    }

    return NextResponse.json({ success: true, payments: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceId, amount, paymentMethod, transactionRef, note } = body;

    if (!invoiceId || !amount || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'invoiceId, amount, and paymentMethod are required' },
        { status: 400 }
      );
    }

    const store = getStore();
    const result = store.recordPayment(
      invoiceId,
      parseFloat(amount),
      paymentMethod,
      transactionRef,
      note
    );

    if (!result) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, payment: result.payment, isDuplicate: result.isDuplicate });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
