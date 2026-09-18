import { GET as healthHandler } from '@/app/api/health/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  return healthHandler();
}
