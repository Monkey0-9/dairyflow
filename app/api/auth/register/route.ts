import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { encodeSignedSession, CLIENT_HINT_COOKIE_NAME, formatClientHint, SESSION_COOKIE_NAME, SessionUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/security/rate-limiter';
import { DeliveryShift } from '@/lib/types';

export async function POST(req: NextRequest) {
  // Rate limiting: 20 registration attempts per IP per minute
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous_ip';
  const limitCheck = checkRateLimit(`register_${ip}`, 20, 60);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { success: false, error: 'Too many registration attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limitCheck.resetTimeSeconds) } }
    );
  }

  try {
    const body = await req.json();
    const { name, phone, address, productId, quantity, deliveryShift } = body;

    if (!name || !phone || !address) {
      return NextResponse.json(
        { success: false, error: 'Name, phone number, and delivery address are required' },
        { status: 400 }
      );
    }

    const store = getStore();

    // Check if phone is already registered
    const existing = store.users.find(
      (u) => u.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, '')
    );
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An account with this phone number already exists. Please log in instead.' },
        { status: 409 }
      );
    }

    const result = store.registerCustomer({
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      productId: productId || 'prod_cow_milk',
      quantity: parseFloat(quantity) || 1.0,
      deliveryShift: (deliveryShift as DeliveryShift) || 'MORNING',
      autoApprove: true, // Default to instant active activation per user's prompt test flow
    });

    const sessionUser: SessionUser = {
      userId: result.user.id,
      name: result.user.name,
      role: 'CUSTOMER',
      tenantId: result.user.tenantId,
      customerId: result.customer.id,
      email: result.user.email,
    };

    const token = encodeSignedSession(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      customer: result.customer,
      subscription: result.subscription,
      redirectUrl: '/customer',
    });

    const isProd = process.env.NODE_ENV === 'production';

    // 1. Primary authenticated session cookie (strictly HttpOnly, protected from XSS)
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      path: '/',
      httpOnly: true,
      secure: isProd,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    // 2. Client-readable hint cookie (non-sensitive: name, role, tenantId only)
    response.cookies.set({
      name: CLIENT_HINT_COOKIE_NAME,
      value: formatClientHint(sessionUser),
      path: '/',
      httpOnly: false,
      secure: isProd,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
