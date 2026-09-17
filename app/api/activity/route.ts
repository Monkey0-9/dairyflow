import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET() {
  try {
    const store = getStore();
    return NextResponse.json({
      success: true,
      activities: store.activities,
      total: store.activities.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch activity stream';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
