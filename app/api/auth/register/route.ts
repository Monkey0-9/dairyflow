import { NextRequest, NextResponse } from 'next/server';

/**
 * Public customer self-registration endpoint.
 * Strictly disabled (HTTP 403 Forbidden).
 * All customers must be created and invited by the Administrator/Farmer.
 */
export async function POST(req?: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'Forbidden: Public customer self-registration is disabled. Customers must be created and invited by an administrator or farmer.',
    },
    { status: 403 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Forbidden: Public customer self-registration is disabled.',
    },
    { status: 403 }
  );
}
