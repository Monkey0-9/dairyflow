import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { enforceActiveAccount } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/security/rate-limiter';

const FARMER_UPI = process.env.FARMER_UPI_ID || 'greenvalley@okaxis';
const FARMER_NAME = process.env.FARMER_BUSINESS_NAME || 'GreenValley Dairy Farm';

/**
 * Create a live Razorpay order via REST (no SDK dependency).
 * Returns null when live keys are absent so callers use sandbox mode.
 */
async function createLiveOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; status: string } | null> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: params.receipt.slice(0, 40),
      notes: params.notes,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Razorpay order creation failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const order = (await res.json()) as { id: string; status: string };
  if (!order?.id) throw new Error('Razorpay returned an order without an id');
  return order;
}

/**
 * POST /api/payments/create-order
 * Live Razorpay order when RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set,
 * otherwise an explicit sandbox order (tests stay hermetic). Always returns
 * a dynamic UPI deep-link for one-tap mobile payment.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
  const limitCheck = checkRateLimit(`create_order_${ip}`, 30, 60);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many order creation requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limitCheck.resetTimeSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    if (session) {
      const suspended = await enforceActiveAccount(session);
      if (suspended) return suspended;
    }

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

    const amountPaise = Math.round(amt * 100);
    const isTest = process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';
    let mode: 'live' | 'sandbox' = 'sandbox';
    let orderId = `order_sandbox_${Date.now()}`;
    let orderStatus = 'created';

    if (!isTest && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      try {
        const live = await createLiveOrder({
          amountPaise,
          receipt: invoiceId,
          notes: {
            invoiceId,
            customerId: invoice?.customerId || session?.customerId || '',
            tenantId: session?.tenantId || '',
          },
        });
        if (live) {
          mode = 'live';
          orderId = live.id;
          orderStatus = live.status;
        }
      } catch (err) {
        console.error('[create-order] Live Razorpay order creation failed:', err);
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { success: false, error: 'Payment gateway temporarily unavailable. Please retry or use UPI payment directly.' },
            { status: 502 }
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      sandbox: mode === 'sandbox',
      mode,
      order: {
        id: orderId,
        amount: amountPaise,
        amountDisplay: amt,
        currency: 'INR',
        receipt: invoiceId,
        status: orderStatus,
        keyId: mode === 'live' ? process.env.RAZORPAY_KEY_ID : 'rzp_test_sandbox',
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
