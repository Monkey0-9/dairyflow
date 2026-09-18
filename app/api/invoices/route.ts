import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getInvoices, generateMonthlyInvoice } from '@/lib/services/billing.service';
import { publishEvent } from '@/lib/events';

const isUnitTest = () => process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId') || undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : 9;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : 2026;

    // DB-first read
    if (!isUnitTest()) {
      try {
        const dbInvoices = await getInvoices({
          customerId,
          tenantId: session?.role === 'CUSTOMER' ? undefined : session?.tenantId,
          farmerId: session?.role === 'FARMER' ? session.farmerId : undefined,
          month,
          year,
        });
        if (dbInvoices.length > 0) {
          let totalBilled = 0;
          let totalCollected = 0;
          let totalOutstanding = 0;
          let totalLitres = 0;
          dbInvoices.forEach((i) => {
            totalBilled += i.totalAmount;
            totalCollected += i.paidAmount;
            totalOutstanding += i.outstandingAmount;
            totalLitres += i.totalQuantity;
          });
          return NextResponse.json({
            success: true,
            source: 'db',
            invoices: dbInvoices,
            summary: {
              totalBilled: parseFloat(totalBilled.toFixed(2)),
              totalCollected: parseFloat(totalCollected.toFixed(2)),
              totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
              totalLitres: parseFloat(totalLitres.toFixed(1)),
              count: dbInvoices.length,
            },
          });
        }
      } catch (err) {
        console.warn('[invoices] DB read failed, falling back to store:', err);
      }
    }

    const store = getStore();
    let list = store.invoices;

    if (customerId) {
      list = list.filter((i) => i.customerId === customerId);
    }
    if (month && year) {
      list = list.filter((i) => i.month === month && i.year === year);
    }

    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let totalLitres = 0;

    list.forEach((i) => {
      totalBilled += i.totalAmount;
      totalCollected += i.paidAmount;
      totalOutstanding += i.outstandingAmount;
      totalLitres += i.totalQuantity;
    });

    return NextResponse.json({
      success: true,
      source: 'store',
      invoices: list,
      summary: {
        totalBilled: parseFloat(totalBilled.toFixed(2)),
        totalCollected: parseFloat(totalCollected.toFixed(2)),
        totalOutstanding: parseFloat(totalOutstanding.toFixed(2)),
        totalLitres: parseFloat(totalLitres.toFixed(1)),
        count: list.length,
      },
    });
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
    const month = body.month || 9;
    const year = body.year || 2026;
    const customerId = body.customerId;

    // DB-first invoice generation (UNIQUE(customer_id, month, year) enforced)
    if (!isUnitTest()) {
      try {
        const store = getStore();
        if (customerId) {
          const cust = store.customers.find((c) => c.id === customerId);
          if (cust) {
            const dbResult = await generateMonthlyInvoice({
              customerId,
              farmerId: body.farmerId || cust.farmerId || store.farmer.id,
              tenantId: session?.tenantId || cust.tenantId || store.tenantId,
              month,
              year,
            });
            if (dbResult.success) {
              publishEvent({
                type: 'invoice:created',
                tenantId: session?.tenantId,
                customerId,
                payload: { invoiceId: dbResult.invoiceId, month, year },
              });
              return NextResponse.json({ success: true, invoiceId: dbResult.invoiceId, source: 'db' });
            }
            if (dbResult.error && !dbResult.error.startsWith('Invoice already exists')) {
              throw new Error(dbResult.error);
            }
          }
        } else {
          // Bulk generation for all DB customers of farmer scope
          const dbInvoices = await getInvoices({ month, year });
          if (dbInvoices.length >= 0) {
            // Fall through to store bulk to preserve seed behavior in demo; DB singles handled above
          }
        }
      } catch (err) {
        console.warn('[invoices] DB generate failed, falling back to store:', err);
      }
    }

    const store = getStore();
    if (customerId) {
      const inv = store.recalculateMonthlyInvoice(customerId, month, year);
      return NextResponse.json({ success: true, invoice: inv, source: 'store' });
    }

    const updatedInvoices = [];
    for (const cust of store.customers) {
      const inv = store.recalculateMonthlyInvoice(cust.id, month, year);
      if (inv) updatedInvoices.push(inv);
    }

    return NextResponse.json({ success: true, invoices: updatedInvoices, source: 'store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
