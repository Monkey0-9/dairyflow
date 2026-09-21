import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { decodeSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { enforceCustomerOwnership } from '@/lib/api-auth';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/customer/360
 * Comprehensive Customer 360 Intelligence Profile (Stage 15).
 */
export async function GET(req: NextRequest) {
  try {
    const token =
      req.cookies.get(SESSION_COOKIE_NAME)?.value ||
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const session = decodeSession(token);
    const { searchParams } = new URL(req.url);

    const customerId = searchParams.get('customerId') || session?.customerId;

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
    }

    if (session && session.role === 'CUSTOMER') {
      const violation = enforceCustomerOwnership(session, customerId);
      if (violation) return violation;
    }

    // 1. Fetch Profile & Subscription details from DB or store
    let customerName = 'Customer';
    let milkType = 'Cow';
    let dailyQuantity = 1.0;
    let deliveryAddress = '';

    try {
      const custRes = await query(
        `SELECT c.id, c.milk_type, c.daily_quantity::float, c.delivery_address, u.name
         FROM customer_profiles c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = $1`,
        [customerId]
      );
      if (custRes.rows.length > 0) {
        const row = custRes.rows[0];
        customerName = row.name;
        milkType = row.milk_type || 'Cow';
        dailyQuantity = row.daily_quantity || 1.0;
        deliveryAddress = row.delivery_address || '';
      }
    } catch (err) {
      console.error('[customer/360] DB customer profile query failed, using store fallback:', err);
      const store = getStore();
      const stCust = store.customers.find((c) => c.id === customerId);
      if (stCust) {
        customerName = stCust.name;
        const sub = store.subscriptions.find((s) => s.customerId === customerId);
        dailyQuantity = sub ? sub.defaultQuantity : 1.0;
        deliveryAddress = stCust.address;
      }
    }

    // 2. Fetch delivery records & consumption stats
    let totalDeliveredLiters = 0;
    let deliveredDrops = 0;
    let skippedDrops = 0;
    let totalScheduledDrops = 0;

    try {
      const delRes = await query(
        `SELECT status, delivered_quantity::float as qty
         FROM delivery_records
         WHERE customer_id = $1`,
        [customerId]
      );
      for (const d of delRes.rows) {
        totalScheduledDrops++;
        if (d.status === 'DELIVERED' || d.status === 'EXTRA' || d.status === 'PARTIAL') {
          deliveredDrops++;
          totalDeliveredLiters += d.qty;
        } else if (d.status === 'SKIPPED') {
          skippedDrops++;
        }
      }
    } catch (err) {
      console.error('[customer/360] DB delivery records query failed, using store fallback:', err);
      const store = getStore();
      const records = Array.from(store.deliveryRecords.values()).filter((r) => r.customerId === customerId);
      for (const d of records) {
        totalScheduledDrops++;
        if (d.status === 'DELIVERED' || d.status === 'EXTRA' || d.status === 'PARTIAL') {
          deliveredDrops++;
          totalDeliveredLiters += d.deliveredQuantity;
        } else if (d.status === 'SKIPPED') {
          skippedDrops++;
        }
      }
    }

    // 3. Invoicing & Financial Health
    let totalInvoiced = 0;
    let totalPaid = 0;
    let currentOutstanding = 0;

    try {
      const invRes = await query(
        `SELECT COALESCE(SUM(total_amount::float), 0) as total,
                COALESCE(SUM(paid_amount::float), 0) as paid,
                COALESCE(SUM(outstanding_amount::float), 0) as outstanding
         FROM invoices
         WHERE customer_id = $1`,
        [customerId]
      );
      if (invRes.rows.length > 0) {
        totalInvoiced = invRes.rows[0].total;
        totalPaid = invRes.rows[0].paid;
        currentOutstanding = invRes.rows[0].outstanding;
      }
    } catch (err) {
      console.error('[customer/360] DB invoices query failed, using store fallback:', err);
      const store = getStore();
      const custInvoices = store.invoices.filter((i) => i.customerId === customerId);
      totalInvoiced = custInvoices.reduce((sum, i) => sum + i.totalAmount, 0);
      totalPaid = custInvoices.reduce((sum, i) => sum + i.paidAmount, 0);
      currentOutstanding = custInvoices.reduce((sum, i) => sum + i.outstandingAmount, 0);
    }

    // 4. Compute Churn Signals & Behavioral Metrics
    const skipRate = totalScheduledDrops > 0 ? (skippedDrops / totalScheduledDrops) * 100 : 0;
    let churnRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const churnFactors: string[] = [];

    if (skipRate > 30) {
      churnRisk = 'HIGH';
      churnFactors.push(`High delivery skip rate of ${skipRate.toFixed(1)}%`);
    } else if (skipRate > 15) {
      churnRisk = 'MEDIUM';
      churnFactors.push(`Moderate delivery skip rate of ${skipRate.toFixed(1)}%`);
    }

    if (currentOutstanding > 2000) {
      churnRisk = churnRisk === 'HIGH' ? 'HIGH' : 'MEDIUM';
      churnFactors.push(`Overdue outstanding balance exceeds ₹2,000`);
    }

    const avgDailyLitres =
      deliveredDrops > 0 ? parseFloat((totalDeliveredLiters / deliveredDrops).toFixed(2)) : dailyQuantity;

    return NextResponse.json({
      success: true,
      customer360: {
        customerId,
        customerName,
        deliveryAddress,
        subscription: {
          milkType,
          dailyQuantity,
          status: 'ACTIVE',
        },
        consumption: {
          totalDeliveredLiters: parseFloat(totalDeliveredLiters.toFixed(1)),
          deliveredDropsCount: deliveredDrops,
          skippedDropsCount: skippedDrops,
          averageDailyLitres: avgDailyLitres,
        },
        financials: {
          totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
          totalPaid: parseFloat(totalPaid.toFixed(2)),
          currentOutstanding: parseFloat(currentOutstanding.toFixed(2)),
          paymentBehavior: currentOutstanding <= 0 ? 'PROMPT_PAYER' : 'PAYMENT_PENDING',
        },
        churnIntelligence: {
          riskScore: churnRisk,
          skipRatePercent: parseFloat(skipRate.toFixed(1)),
          churnFactors: churnFactors.length > 0 ? churnFactors : ['Healthy delivery and payment pattern'],
        },
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Customer 360 lookup failed' },
      { status: 500 }
    );
  }
}
