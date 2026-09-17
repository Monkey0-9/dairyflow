import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { encodeSession, SESSION_COOKIE_NAME, SessionUser } from '@/lib/auth';
import { DeliveryShift } from '@/lib/types';

export async function POST(req: NextRequest) {
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

    const token = encodeSession(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      customer: result.customer,
      subscription: result.subscription,
      redirectUrl: '/customer',
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
