import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getInvoices, generateMonthlyInvoice } from '@/lib/services/billing.service';
import { query } from '@/lib/db';
import { isUuid, resolveDbScope } from '@/lib/db-scope';
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

    // DB-first invoice generation (UNIQUE(customer_id, month, year) enforced).
    // Production: customers resolve from PostgreSQL (the store is empty in
    // production) and bulk generation really writes every customer invoice.
    if (!isUnitTest()) {
      try {
        const scope = await resolveDbScope(session);
        if (customerId) {
          const custRes = await query(
            `SELECT id, farmer_id as "farmerId", tenant_id as "tenantId" FROM customer_profiles WHERE id = $1`,
            [customerId]
          );
          if (custRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
          }
          const cust = custRes.rows[0] as { id: string; farmerId: string; tenantId: string };
          const dbResult = await generateMonthlyInvoice({
            customerId: cust.id,
            farmerId: isUuid(body.farmerId) ? body.farmerId : cust.farmerId,
            tenantId: cust.tenantId,
            month,
            year,
          });
          if (dbResult.success) {
            publishEvent({
              type: 'invoice:created',
              tenantId: cust.tenantId,
              customerId,
              payload: { invoiceId: dbResult.invoiceId, month, year },
            });
            return NextResponse.json({ success: true, invoiceId: dbResult.invoiceId, source: 'db' });
          }
          if (dbResult.error && dbResult.error.startsWith('Invoice already exists')) {
            const existing = await getInvoices({ customerId, month, year });
            return NextResponse.json({ success: true, invoiceId: existing[0]?.id, source: 'db', note: dbResult.error });
          }
          throw new Error(dbResult.error || 'Invoice generation failed');
        } else {
          // Bulk generation for every active customer of the dairy.
          const custRes = await query(
            `SELECT id, farmer_id as "farmerId", tenant_id as "tenantId"
             FROM customer_profiles WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC`,
            [scope.tenantId]
          );
          const generated: string[] = [];
          const skipped: { customerId: string; reason: string }[] = [];
          for (const c of custRes.rows as { id: string; farmerId: string; tenantId: string }[]) {
            const dbResult = await generateMonthlyInvoice({
              customerId: c.id,
              farmerId: c.farmerId,
              tenantId: c.tenantId,
              month,
              year,
            });
            if (dbResult.success && dbResult.invoiceId) generated.push(dbResult.invoiceId);
            else skipped.push({ customerId: c.id, reason: dbResult.error || 'unknown' });
          }
          return NextResponse.json({ success: true, source: 'db', invoiceIds: generated, generatedCount: generated.length, skipped });
        }
      } catch (err) {
        console.error('[invoices] DB generate failed:', err);
        const message = err instanceof Error ? err.message : 'Invoice generation failed';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
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
