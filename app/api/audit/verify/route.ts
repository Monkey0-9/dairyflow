import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export async function GET() {
  try {
    const store = getStore();
    const verification = store.verifyAuditChain();

    return NextResponse.json({
      success: true,
      verification: {
        ...verification,
        algorithm: 'SHA-256',
        verifiedAt: new Date().toISOString(),
        genesisBlock: store.auditChain[0]
          ? {
              index: store.auditChain[0].blockIndex,
              hash: store.auditChain[0].currentHash,
              timestamp: store.auditChain[0].timestamp,
            }
          : null,
        headBlock: store.auditChain[store.auditChain.length - 1]
          ? {
              index: store.auditChain[store.auditChain.length - 1].blockIndex,
              hash: store.auditChain[store.auditChain.length - 1].currentHash,
              timestamp: store.auditChain[store.auditChain.length - 1].timestamp,
            }
          : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
