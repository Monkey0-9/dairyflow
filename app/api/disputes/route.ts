import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { listDisputes, createDispute, resolveDispute } from '@/lib/services/dispute.service';
import { query } from '@/lib/db';
import { isUuid } from '@/lib/db-scope';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId') || undefined;
    const farmerId = searchParams.get('farmerId') || undefined;
    const status = searchParams.get('status') || undefined;

    if (!isUnitTest()) {
      try {
        const dbList = await listDisputes({ customerId, farmerId, status });
        if (dbList.length > 0) {
          return NextResponse.json({ success: true, disputes: dbList, source: 'db' });
        }
      } catch (err) {
        console.warn('[disputes] DB read failed, falling back to store:', err);
      }
    }

    const store = getStore();
    let list = store.disputes;
    if (customerId) list = list.filter((d) => d.customerId === customerId);
    if (status) list = list.filter((d) => d.status === status);

    return NextResponse.json({ success: true, disputes: list, source: 'store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { customerId, deliveryRecordId, deliveryId, claimedQuantity, reason, issueType, customerNote, date } = body;

    const targetCustomerId = customerId || session?.customerId;
    const targetDeliveryId = deliveryRecordId || deliveryId;

    if (!targetCustomerId || !targetDeliveryId || claimedQuantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'customerId, deliveryRecordId, and claimedQuantity are required' },
        { status: 400 }
      );
    }

    // DB-first direct INSERT INTO disputes.
    // Production: the service resolves tenant/farmer from the customer row
    // (the store is empty in production), and failures are reported loudly —
    // a store-only "success" would vanish on restart.
    if (!isUnitTest()) {
      try {
        // Resolve date for DB row (database first: store is empty in production)
        let disputeDate = date;
        if (!disputeDate) {
          try {
            const recRes = await query(`SELECT date FROM delivery_records WHERE id = $1`, [targetDeliveryId]);
            disputeDate = recRes.rows[0]?.date || new Date().toISOString().slice(0, 10);
          } catch {
            const store = getStore();
            const rec = store.deliveryRecords.get(targetDeliveryId);
            disputeDate = rec?.date || new Date().toISOString().slice(0, 10);
          }
        }
        const dbResult = await createDispute({
          customerId: targetCustomerId,
          farmerId: undefined,
          tenantId: isUuid(session?.tenantId) ? session?.tenantId : undefined,
          deliveryId: targetDeliveryId,
          date: disputeDate,
          issueType: issueType || reason || 'NOT_DELIVERED',
          claimedQuantity: parseFloat(claimedQuantity),
          customerNotes: customerNote || 'Customer reported issue',
        });
        if (dbResult.success) {
          publishEvent({
            type: 'dispute:opened',
            tenantId: session?.tenantId,
            customerId: targetCustomerId,
            payload: { disputeId: dbResult.id, deliveryId: targetDeliveryId },
          });
          return NextResponse.json(
            { success: true, dispute: { id: dbResult.id }, source: 'db' },
            { status: 201 }
          );
        }
        if (dbResult.error === 'Customer not found' || dbResult.error === 'Delivery record not found') {
          return NextResponse.json({ success: false, error: dbResult.error }, { status: 404 });
        }
        throw new Error(dbResult.error || 'Failed to record dispute');
      } catch (err) {
        console.error('[disputes] DB insert failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to record dispute';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }

    const store = getStore();
    const dispute = store.submitDispute(
      targetCustomerId,
      targetDeliveryId,
      parseFloat(claimedQuantity),
      reason || 'DID_NOT_RECEIVE',
      customerNote || 'Customer reported issue'
    );

    if (!dispute) {
      return NextResponse.json({ success: false, error: 'Delivery record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, dispute, source: 'store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { disputeId, action, customQuantity, farmerNote } = body;

    if (!disputeId || !action) {
      return NextResponse.json({ success: false, error: 'disputeId and action are required' }, { status: 400 });
    }

    // Map store-style actions (ACCEPT/REJECT/ADJUST) to DB resolver
    const normalized = String(action).toUpperCase();
    const dbAction =
      normalized === 'ACCEPT' || normalized === 'APPROVED' || normalized === 'RESOLVE' || normalized === 'RESOLVED'
        ? 'ACCEPT'
        : normalized === 'REJECT' || normalized === 'REJECTED'
          ? 'REJECT'
          : normalized === 'ADJUST'
            ? 'ADJUST'
            : null;

    if (!isUnitTest() && dbAction) {
      try {
        const dbResult = await resolveDispute({
          disputeId,
          action: dbAction as 'ACCEPT' | 'REJECT' | 'ADJUST',
          customQuantity: customQuantity !== undefined ? parseFloat(customQuantity) : undefined,
          farmerNote,
        });
        if (dbResult.success) {
          publishEvent({
            type: 'dispute:resolved',
            tenantId: session?.tenantId,
            payload: { disputeId, action: dbAction },
          });
          return NextResponse.json({ success: true, disputeId, action: dbAction, source: 'db' });
        }
        if (dbResult.error === 'Dispute not found') {
          return NextResponse.json({ success: false, error: dbResult.error }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: dbResult.error || 'Failed to resolve dispute' }, { status: 400 });
      } catch (err) {
        // Production: report loudly instead of a store-only false success.
        console.error('[disputes] DB resolve failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to resolve dispute';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
    }

    if (!isUnitTest() && !dbAction) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use ACCEPT, REJECT, or ADJUST.' },
        { status: 400 }
      );
    }

    const store = getStore();
    const result = store.resolveDispute(
      disputeId,
      action,
      customQuantity !== undefined ? parseFloat(customQuantity) : undefined,
      farmerNote
    );

    if (!result) {
      return NextResponse.json({ success: false, error: 'Dispute or record not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, source: 'store', ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
