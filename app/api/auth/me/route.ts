import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(sessionCookie);

    if (!session) {
      return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
    }

    const store = getStore();
    const customer = session.customerId
      ? store.customers.find((c) => c.id === session.customerId)
      : store.customers.find((c) => c.userId === session.userId);

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: session,
      customer: customer || null,
      farmer: store.farmer,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Auth verification failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
