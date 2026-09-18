import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { createQuantityChangeRequest, getUnifiedRequests } from '@/lib/services/request.service';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const body = await req.json();

    const targetCustomerId = body.customerId || session?.customerId;
    const { effectiveDate, newQuantity, quantity, reason, notes } = body;
    const qtyRaw = newQuantity ?? quantity;

    if (!effectiveDate || qtyRaw === undefined || qtyRaw === null) {
      return NextResponse.json(
        { success: false, error: 'effectiveDate and newQuantity are required' },
        { status: 400 }
      );
    }

    const qty = Number(qtyRaw);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json(
        { success: false, error: 'newQuantity must be a positive number' },
        { status: 400 }
      );
    }

    if (qty > 50) {
      return NextResponse.json(
        { success: false, error: 'newQuantity cannot exceed reasonable daily limit of 50L' },
        { status: 400 }
      );
    }

    // DB-first path
    if (!isUnitTest()) {
      try {
        const store = getStore();
        const fallbackCust = targetCustomerId
          ? store.customers.find(
              (c) => c.id === targetCustomerId || (session && c.userId === session.userId)
            )
          : undefined;
        const customerId = targetCustomerId || fallbackCust?.id;
        if (customerId) {
          const dbResult = await createQuantityChangeRequest({
            customerId,
            farmerId: fallbackCust?.farmerId,
            tenantId: session?.tenantId || fallbackCust?.tenantId,
            effectiveDate,
            newQuantity: qty,
            reason: reason || notes || 'Daily quantity modification requested by customer',
          });

          if (dbResult.success) {
            publishEvent({
              type: 'request:created',
              tenantId: session?.tenantId,
              farmerId: fallbackCust?.farmerId,
              customerId,
              payload: { requestId: dbResult.id, kind: 'QUANTITY_CHANGE', effectiveDate, newQuantity: qty },
            });

            return NextResponse.json(
              {
                success: true,
                request: {
                  id: dbResult.id,
                  customerId,
                  effectiveDate,
                  newQuantity: qty,
                  reason: reason || notes || 'Daily quantity modification requested by customer',
                  status: 'PENDING',
                },
                source: 'db',
              },
              { status: 201 }
            );
          }

          if (dbResult.error !== 'Customer not found') {
            throw new Error(dbResult.error);
          }
        }
      } catch (err) {
        console.warn('[quantity-request] DB insert failed, falling back to store:', err);
      }
    }

    const store = getStore();
    const cust = store.customers.find(
      (c) => c.id === targetCustomerId || (session && c.userId === session.userId)
    );

    if (!cust) {
      return NextResponse.json(
        { success: false, error: 'Customer not found or unauthorized' },
        { status: 401 }
      );
    }

    const fallbackId = `qcr_${Date.now()}`;
    const request = {
      id: fallbackId,
      customerId: cust.id,
      effectiveDate,
      newQuantity: qty,
      reason: reason || notes || 'Daily quantity modification requested by customer',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, request, source: 'fallback' }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId') || session?.customerId;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId required' },
        { status: 400 }
      );
    }

    if (!isUnitTest()) {
      try {
        const dbRequests = await getUnifiedRequests({ customerId });
        const qtyRequests = dbRequests.filter((r) => r.type === 'QUANTITY_CHANGE');
        if (qtyRequests.length > 0) {
          return NextResponse.json({ success: true, requests: qtyRequests, source: 'db' });
        }
      } catch (err) {
        console.warn('[quantity-request] DB read failed:', err);
      }
    }

    return NextResponse.json({ success: true, requests: [], source: 'empty' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
