import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    let list = store.notifications;
    if (userId) {
      list = list.filter((n) => n.userId === userId);
    }

    return NextResponse.json({ success: true, notifications: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { notificationId } = body;
    const store = getStore();

    if (notificationId === 'ALL') {
      store.notifications.forEach((n) => (n.read = true));
      return NextResponse.json({ success: true });
    }

    const item = store.notifications.find((n) => n.id === notificationId);
    if (item) item.read = true;

    return NextResponse.json({ success: true, notification: item });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
