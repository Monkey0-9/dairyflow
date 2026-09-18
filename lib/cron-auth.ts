import { NextRequest, NextResponse } from 'next/server';

/**
 * Guard for Vercel Cron routes. Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when the secret is configured.
 * A `?secret=` query fallback supports manual/local invocation.
 * Fail-closed in production when CRON_SECRET is unset.
 */
export function authorizeCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Cron is not configured (CRON_SECRET missing)' },
        { status: 500 }
      );
    }
    return null; // local dev convenience
  }
  const header = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const param = new URL(req.url).searchParams.get('secret');
  if (header !== secret && param !== secret) {
    return NextResponse.json({ success: false, error: 'Unauthorized cron caller' }, { status: 401 });
  }
  return null;
}
