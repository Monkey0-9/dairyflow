import { NextResponse } from 'next/server';
import { CLIENT_HINT_COOKIE_NAME, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    redirectUrl: '/login',
  });

  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(CLIENT_HINT_COOKIE_NAME);
  return response;
}
