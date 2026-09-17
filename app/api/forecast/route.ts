import { NextResponse } from 'next/server';
import { generateAIDemandForecast } from '@/lib/ai-forecasting';

export async function GET() {
  try {
    const forecast = generateAIDemandForecast();
    return NextResponse.json({ success: true, forecast });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
