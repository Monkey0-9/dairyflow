import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { encodeSession, PRESET_DEMO_USERS, SESSION_COOKIE_NAME, SessionUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { demoUserId, phone, password } = body;
    const store = getStore();

    let sessionUser: SessionUser | null = null;

    if (demoUserId) {
      // 1-tap quick persona switcher login
      if (PRESET_DEMO_USERS[demoUserId]) {
        sessionUser = PRESET_DEMO_USERS[demoUserId];
      } else {
        // Find in store
        const user = store.users.find((u) => u.id === demoUserId);
        const cust = store.customers.find((c) => c.userId === demoUserId);
        if (user) {
          sessionUser = {
            userId: user.id,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId,
            customerId: cust?.id,
            email: user.email,
          };
        }
      }
    } else if (phone) {
      // Phone/password credential login
      const cleanPhone = phone.trim();
      const user = store.users.find(
        (u) => u.phone.includes(cleanPhone) || u.phone.replace(/[^0-9]/g, '').includes(cleanPhone)
      );

      if (user) {
        const cust = store.customers.find((c) => c.userId === user.id);
        sessionUser = {
          userId: user.id,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          customerId: cust?.id,
          email: user.email,
        };
      } else {
        return NextResponse.json(
          { success: false, error: 'No account found with this phone number. Please register first.' },
          { status: 401 }
        );
      }
    }

    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid login credentials or persona' },
        { status: 400 }
      );
    }

    let redirectUrl = '/admin';
    if (sessionUser.role === 'CUSTOMER') {
      redirectUrl = '/customer';
    } else if (sessionUser.role === 'ADMIN') {
      redirectUrl = '/superadmin';
    }

    const token = encodeSession(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
      redirectUrl,
    });

    // Set secure session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      path: '/',
      httpOnly: false, // readable for client fast-sync
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
