import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);

    let customerId = searchParams.get('customerId') || session?.customerId;

    if (!customerId && session?.userId) {
      const cust = store.customers.find((c) => c.userId === session.userId);
      if (cust) customerId = cust.id;
    }

    if (!customerId) {
      // Default to Ravi Kumar for demo if unauthenticated
      customerId = 'cust_ravi';
    }

    const data = store.getCustomerDashboardData(customerId);
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
