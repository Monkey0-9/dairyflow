import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { query } from '@/lib/db';
import { isTestMode } from '@/lib/db-scope';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    // Production: durable read from PostgreSQL.
    if (!isTestMode()) {
      try {
        const params: unknown[] = [];
        let sql = `
          SELECT id, tenant_id as "tenantId", user_id as "userId",
                 title, message, type, is_read as "read",
                 created_at as "timestamp"
          FROM notifications WHERE 1=1`;
        if (userId) {
          params.push(userId);
          sql += ` AND user_id = $${params.length}`;
        }
        sql += ` ORDER BY created_at DESC LIMIT 200`;
        const res = await query(sql, params);
        return NextResponse.json({ success: true, notifications: res.rows, source: 'db' });
      } catch (err) {
        console.error('[notifications] DB read failed:', err);
        return NextResponse.json({ success: false, error: 'Failed to load notifications' }, { status: 500 });
      }
    }

    const store = getStore();

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
    const { notificationId, userId } = body;

    // Production: durable mark-read in PostgreSQL.
    if (!isTestMode()) {
      try {
        if (notificationId === 'ALL') {
          if (!userId) {
            return NextResponse.json({ success: false, error: 'userId is required to mark all as read' }, { status: 400 });
          }
          await query(`UPDATE notifications SET is_read = true WHERE user_id = $1`, [userId]);
          return NextResponse.json({ success: true, source: 'db' });
        }
        if (!notificationId) {
          return NextResponse.json({ success: false, error: 'notificationId is required' }, { status: 400 });
        }
        const res = await query(`UPDATE notifications SET is_read = true WHERE id = $1 RETURNING id`, [notificationId]);
        if (res.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Notification not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, source: 'db' });
      } catch (err) {
        console.error('[notifications] DB mark-read failed:', err);
        return NextResponse.json({ success: false, error: 'Failed to update notification' }, { status: 500 });
      }
    }

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
