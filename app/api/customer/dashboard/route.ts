import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const queryCustomerId = searchParams.get('customerId');

    // Customer can only view their own dashboard; Farmer/Admin can view any customer
    let targetCustomerId = queryCustomerId;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    if (session.role === 'CUSTOMER') {
      targetCustomerId = session.customerId || null;
    } else if (!targetCustomerId && session.customerId) {
      targetCustomerId = session.customerId;
    }

    if (!targetCustomerId) {
      return NextResponse.json(
        { success: false, error: 'Customer identifier is required' },
        { status: 400 }
      );
    }

    // 1. Authoritative Customer Profile from PostgreSQL
    const custRes = await query<{
      id: string;
      tenant_id: string;
      user_id: string;
      farmer_id: string;
      delivery_address: string;
      milk_type: string;
      daily_quantity: string;
      qr_token: string;
      is_active: boolean;
      status: string;
      name: string;
      email: string;
      phone: string;
      farmer_name: string;
      upi_id: string;
    }>(
      `SELECT c.id, c.tenant_id, c.user_id, c.farmer_id, c.delivery_address,
              c.milk_type, c.daily_quantity, c.qr_token, c.is_active, c.status,
              u.name, u.email, u.phone,
              fu.name as farmer_name, f.upi_id
       FROM customer_profiles c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN farmer_profiles f ON c.farmer_id = f.id
       LEFT JOIN users fu ON f.user_id = fu.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [targetCustomerId, session.tenantId]
    );

    if (custRes.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Customer not found in PostgreSQL' },
        { status: 404 }
      );
    }

    const customer = custRes.rows[0];

    // 2. Active Subscription from PostgreSQL
    const subRes = await query<{
      id: string;
      product_id: string;
      quantity: string;
      frequency: string;
      status: string;
      product_name: string;
      price_per_unit: string;
    }>(
      `SELECT s.id, s.product_id, s.quantity, s.frequency, s.status,
              p.name as product_name, p.price_per_unit
       FROM subscriptions s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.customer_id = $1 AND s.tenant_id = $2
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [targetCustomerId, session.tenantId]
    );

    const subscription = subRes.rows[0] || null;

    // 3. Deliveries for the current month
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;

    const deliveriesRes = await query<{
      id: string;
      date: string;
      scheduled_quantity: string;
      delivered_quantity: string;
      price_per_unit: string;
      status: string;
      notes: string | null;
    }>(
      `SELECT id, date, scheduled_quantity, delivered_quantity, price_per_unit, status, notes
       FROM delivery_records
       WHERE customer_id = $1 AND tenant_id = $2 AND date >= $3 AND date <= $4
       ORDER BY date DESC`,
      [targetCustomerId, session.tenantId, startOfMonth, endOfMonth]
    );

    // 4. Invoices and Payments
    const invoicesRes = await query<{
      id: string;
      month: number;
      year: number;
      total_amount: string;
      paid_amount: string;
      outstanding_amount: string;
      status: string;
      pdf_url: string | null;
    }>(
      `SELECT id, month, year, total_amount, paid_amount, outstanding_amount, status, pdf_url
       FROM invoices
       WHERE customer_id = $1 AND tenant_id = $2
       ORDER BY year DESC, month DESC
       LIMIT 6`,
      [targetCustomerId, session.tenantId]
    );

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.delivery_address,
          milkType: customer.milk_type,
          dailyQuantity: parseFloat(customer.daily_quantity),
          qrToken: customer.qr_token,
          status: customer.status,
          isActive: customer.is_active,
          farmerName: customer.farmer_name,
          upiId: customer.upi_id,
        },
        subscription: subscription
          ? {
              id: subscription.id,
              productName: subscription.product_name,
              quantity: parseFloat(subscription.quantity),
              pricePerUnit: parseFloat(subscription.price_per_unit),
              status: subscription.status,
            }
          : null,
        deliveries: deliveriesRes.rows.map((d) => ({
          id: d.id,
          date: d.date,
          scheduledQuantity: parseFloat(d.scheduled_quantity),
          deliveredQuantity: parseFloat(d.delivered_quantity),
          pricePerUnit: parseFloat(d.price_per_unit),
          status: d.status,
          notes: d.notes,
        })),
        invoices: invoicesRes.rows.map((inv) => ({
          id: inv.id,
          month: inv.month,
          year: inv.year,
          totalAmount: parseFloat(inv.total_amount),
          paidAmount: parseFloat(inv.paid_amount),
          outstandingAmount: parseFloat(inv.outstanding_amount),
          status: inv.status,
          pdfUrl: inv.pdf_url,
        })),
      },
    });
  } catch (error: unknown) {
    console.error('[Customer Dashboard API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Database service temporarily unavailable' },
      { status: 503 }
    );
  }
}
