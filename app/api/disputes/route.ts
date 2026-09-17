import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const status = searchParams.get('status');

    let list = store.disputes;
    if (customerId) list = list.filter((d) => d.customerId === customerId);
    if (status) list = list.filter((d) => d.status === status);

    return NextResponse.json({ success: true, disputes: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, deliveryRecordId, claimedQuantity, reason, customerNote } = body;

    if (!customerId || !deliveryRecordId || claimedQuantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'customerId, deliveryRecordId, and claimedQuantity are required' },
        { status: 400 }
      );
    }

    const store = getStore();
    const dispute = store.submitDispute(
      customerId,
      deliveryRecordId,
      parseFloat(claimedQuantity),
      reason || 'DID_NOT_RECEIVE',
      customerNote || 'Customer reported issue'
    );

    if (!dispute) {
      return NextResponse.json({ success: false, error: 'Delivery record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, dispute });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { disputeId, action, customQuantity, farmerNote } = body;

    if (!disputeId || !action) {
      return NextResponse.json({ success: false, error: 'disputeId and action are required' }, { status: 400 });
    }

    const store = getStore();
    const result = store.resolveDispute(
      disputeId,
      action,
      customQuantity !== undefined ? parseFloat(customQuantity) : undefined,
      farmerNote
    );

    if (!result) {
      return NextResponse.json({ success: false, error: 'Dispute or record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
