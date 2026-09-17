import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get('entityType');

    let chain = store.auditChain;
    if (entityType) {
      chain = chain.filter((b) => b.entityType === entityType);
    }

    return NextResponse.json({
      success: true,
      auditChain: chain,
      totalBlocks: store.auditChain.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit chain';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
