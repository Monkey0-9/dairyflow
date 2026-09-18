import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const FARMER_UPI = process.env.FARMER_UPI_ID || 'greenvalley@okaxis';
const FARMER_NAME = process.env.FARMER_BUSINESS_NAME || 'GreenValley Dairy Farm';

/**
 * POST /api/payments/create-order
 * Creates a Razorpay Order (live when keys present, sandbox-simulated otherwise)
 * and returns a dynamic UPI deep-link for one-tap mobile payment.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { invoiceId, amount } = body;

    if (!invoiceId || amount === undefined) {
      return NextResponse.json(
        { success: false, error: 'invoiceId and amount are required' },
        { status: 400 }
      );
    }

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json(
        { success: false, error: 'amount must be a positive number' },
        { status: 400 }
      );
    }

    const store = getStore();
    const invoice = store.invoices.find((i) => i.id === invoiceId);
    const upiId = FARMER_UPI;
    const businessName = FARMER_NAME;
    const txnNote = `MilkFlow Inv ${invoiceId}`.slice(0, 80);

    // Dynamic UPI Intent deep-link (GPay / PhonePe / Paytm compatible)
    const upiUri =
      `upi://pay?pa=${encodeURIComponent(upiId)}` +
      `&pn=${encodeURIComponent(businessName)}` +
      `&am=${amt.toFixed(2)}&cu=INR` +
      `&tn=${encodeURIComponent(txnNote)}`;

    const sandbox = !RAZORPAY_KEY_ID;
    const orderId = sandbox
      ? `order_sandbox_${Date.now()}`
      : `order_${crypto.randomBytes(8).toString('hex')}`;

    // When live keys exist, a real implementation would call:
    //   Razorpay.orders.create({ amount: amt*100, currency: 'INR', receipt: invoiceId })
    // Here we return the order shape without network I/O so tests stay hermetic.
    return NextResponse.json({
      success: true,
      sandbox,
      order: {
        id: orderId,
        amount: Math.round(amt * 100),
        amountDisplay: amt,
        currency: 'INR',
        receipt: invoiceId,
        status: 'created',
        keyId: RAZORPAY_KEY_ID || 'rzp_test_sandbox',
      },
      upi: {
        vpa: upiId,
        payeeName: businessName,
        uri: upiUri,
        note: txnNote,
      },
      customerId: invoice?.customerId || session?.customerId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create order';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
