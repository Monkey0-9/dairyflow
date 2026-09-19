import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { query } from '@/lib/db';
import { CustomerProfile, Subscription } from '@/lib/types';

// Helper to sync real DB customers into in-memory store
async function syncDbCustomersIntoStore() {
  const store = getStore();
  try {
    const res = await query<{
      customerId: string;
      userId: string;
      tenantId: string;
      farmerId: string;
      deliveryAddress: string;
      milkType: string;
      dailyQuantity: string;
      qrToken: string;
      customerActive: boolean;
      name: string;
      email: string;
      phone: string;
      userActive: boolean;
      subId: string | null;
      subProductId: string | null;
      subQuantity: string | null;
      subStatus: string | null;
    }>(
      `SELECT c.id as "customerId", c.user_id as "userId", c.tenant_id as "tenantId",
              c.farmer_id as "farmerId", c.delivery_address as "deliveryAddress",
              c.milk_type as "milkType", c.daily_quantity as "dailyQuantity",
              c.qr_token as "qrToken", c.is_active as "customerActive",
              u.name, u.email, u.phone, u.is_active as "userActive",
              s.id as "subId", s.product_id as "subProductId",
              s.quantity as "subQuantity", s.status as "subStatus"
       FROM customer_profiles c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN subscriptions s ON s.customer_id = c.id
       ORDER BY c.created_at ASC`
    );

    for (const row of res.rows) {
      const isApproved = row.customerActive && row.userActive;
      const existingCust = store.customers.find((c) => c.id === row.customerId);
      const prodObj = store.products.find((p) => p.id === (row.subProductId || row.milkType)) || store.products[0];

      if (!existingCust) {
        const custCode = `MK-${1020 + store.customers.length + 1}`;
        const newCust: CustomerProfile = {
          id: row.customerId,
          tenantId: row.tenantId || store.tenantId,
          userId: row.userId,
          farmerId: row.farmerId || store.farmer.id,
          customerCode: custCode,
          qrToken: row.qrToken,
          name: row.name,
          phone: row.phone,
          email: row.email,
          address: row.deliveryAddress,
          deliveryShift: 'MORNING',
          deliveryTime: '06:30 AM',
          deliverySequence: store.customers.length + 1,
          active: isApproved,
          accountStatus: isApproved ? 'ACTIVE' : 'PENDING',
          notes: isApproved ? 'Verified client' : 'Self-registered client awaiting admin approval',
          walletBalance: 0,
        };
        store.customers.push(newCust);

        // Also ensure user in store
        if (!store.users.find((u) => u.id === row.userId)) {
          store.users.push({
            id: row.userId,
            tenantId: row.tenantId || store.tenantId,
            name: row.name,
            email: row.email,
            phone: row.phone,
            role: 'CUSTOMER',
          });
        }

        // Also ensure subscription in store
        const subId = row.subId || `sub_${row.customerId}`;
        if (!store.subscriptions.find((s) => s.customerId === row.customerId)) {
          const newSub: Subscription = {
            id: subId,
            tenantId: row.tenantId || store.tenantId,
            customerId: row.customerId,
            farmerId: row.farmerId || store.farmer.id,
            productId: row.subProductId || row.milkType || 'prod_cow_milk',
            productName: prodObj?.name || 'Fresh Cow Milk',
            defaultQuantity: parseFloat(row.subQuantity || row.dailyQuantity || '1.0'),
            customPricePerUnit: prodObj?.basePrice || 50,
            deliveryDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
            deliveryShift: 'MORNING',
            startDate: new Date().toISOString().split('T')[0],
            active: isApproved,
          };
          store.subscriptions.push(newSub);
        }
      } else {
        // Sync active flags
        existingCust.active = isApproved;
        existingCust.accountStatus = isApproved ? 'ACTIVE' : 'PENDING';
        existingCust.name = row.name;
        existingCust.phone = row.phone;
        existingCust.address = row.deliveryAddress;
      }
    }
  } catch (err) {
    console.warn('[Customer sync error]:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    await syncDbCustomersIntoStore();
    const store = getStore();
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('id');

    if (customerId) {
      const customer = store.customers.find((c) => c.id === customerId);
      if (!customer) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }
      const subscription = store.subscriptions.find((s) => s.customerId === customerId);
      const invoices = store.invoices.filter((i) => i.customerId === customerId);
      const payments = store.payments.filter((p) => p.customerId === customerId);
      const disputes = store.disputes.filter((d) => d.customerId === customerId);
      const vacations = store.vacationPauses.filter((v) => v.customerId === customerId);

      return NextResponse.json({
        success: true,
        customer,
        subscription,
        invoices,
        payments,
        disputes,
        vacations,
      });
    }

    const farmerId = searchParams.get('farmerId');
    let filteredCustomers = store.customers;
    if (farmerId) {
      filteredCustomers = filteredCustomers.filter((c) => !c.farmerId || c.farmerId === farmerId);
    }

    const customersWithSubs = filteredCustomers.map((c) => {
      const sub = store.subscriptions.find((s) => s.customerId === c.id);
      const now = new Date();
      const latestInvoice = store.invoices.find(
        (i) => i.customerId === c.id && i.month === now.getMonth() + 1 && i.year === now.getFullYear()
      );
      return {
        ...c,
        subscription: sub,
        currentInvoice: latestInvoice,
      };
    });

    return NextResponse.json({
      success: true,
      customers: customersWithSubs,
      products: store.products,
      farmer: store.farmer,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch customers';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();

    if (!body.name || !body.phone || !body.productId || !body.quantity) {
      return NextResponse.json(
        { success: false, error: 'Name, phone, product, and quantity are required.' },
        { status: 400 }
      );
    }

    const cleanDigits = body.phone.replace(/[^0-9]/g, '');
    const email = body.email ? body.email.trim().toLowerCase() : `${cleanDigits || Date.now()}@dairyclient.com`;
    const password = body.password ? body.password.trim() : `Milk#${Math.floor(1000 + Math.random() * 9000)}`;

    const newCustomer = store.addCustomer({
      name: body.name,
      phone: body.phone,
      email,
      password,
      address: body.address || 'Local Residence',
      productId: body.productId,
      quantity: parseFloat(body.quantity),
      deliveryTime: body.deliveryTime || '06:30 AM',
      deliveryShift: body.deliveryShift || 'MORNING',
      customPrice: body.customPrice ? parseFloat(body.customPrice) : undefined,
      notes: body.notes,
      farmerId: body.farmerId,
    });

    // Dual-persist to PostgreSQL
    try {
      await query(
        `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (id) DO NOTHING`,
        [newCustomer.userId, store.tenantId, email, body.phone, body.name, 'hash_temp', 'salt_temp', 'CUSTOMER']
      );

      await query(
        `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (id) DO NOTHING`,
        [
          newCustomer.id,
          newCustomer.userId,
          store.tenantId,
          newCustomer.farmerId,
          body.address || 'Local Residence',
          body.productId,
          parseFloat(body.quantity),
          newCustomer.qrToken,
        ]
      );

      await query(
        `INSERT INTO subscriptions (id, tenant_id, customer_id, product_id, farmer_id, quantity, frequency, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'DAILY', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [`sub_${newCustomer.id}`, store.tenantId, newCustomer.id, body.productId, newCustomer.farmerId, parseFloat(body.quantity)]
      );

      const todayStr = new Date().toISOString().split('T')[0];
      const prodPrice = body.customPrice ? parseFloat(body.customPrice) : 50.0;
      await query(
        `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EXPECTED')
         ON CONFLICT (customer_id, date, product_id) DO NOTHING`,
        [
          `del_${todayStr}_${newCustomer.id}`,
          store.tenantId,
          newCustomer.id,
          newCustomer.farmerId,
          body.productId,
          todayStr,
          parseFloat(body.quantity),
          parseFloat(body.quantity),
          prodPrice,
        ]
      );
    } catch (dbErr) {
      console.warn('[Customer API POST] DB persistence warning:', dbErr);
    }

    return NextResponse.json({
      success: true,
      customer: newCustomer,
      credentials: {
        email,
        phone: body.phone,
        temporaryPassword: newCustomer.temporaryPassword || password,
        loginUrl: '/login',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add customer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let customerId = searchParams.get('id') || searchParams.get('customerId');

    if (!customerId) {
      try {
        const body = await req.json();
        customerId = body.customerId || body.id;
      } catch {
        // No body provided, fallback to query param check
      }
    }

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId is required to remove client' }, { status: 400 });
    }

    const store = getStore();
    const removed = store.deleteCustomer(customerId);

    // Delete from PostgreSQL
    try {
      await query(`DELETE FROM delivery_records WHERE customer_id = $1`, [customerId]);
      await query(`DELETE FROM subscriptions WHERE customer_id = $1`, [customerId]);
      await query(`DELETE FROM customer_profiles WHERE id = $1`, [customerId]);
    } catch (dbErr) {
      console.warn('[Customer API DELETE] DB delete warning:', dbErr);
    }

    if (!removed) {
      return NextResponse.json({ success: false, error: 'Customer not found or already removed' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Customer ${customerId} successfully removed.`,
      customerId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove customer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerId,
      action,
      status,
      approvedBy,
      name,
      email,
      phone,
      address,
      deliveryTime,
      deliveryShift,
      deliverySequence,
      notes,
      productId,
      quantity,
      customPrice,
    } = body;
    const store = getStore();

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
    }

    // 1. APPROVE ACTION
    if (action === 'APPROVE') {
      const approved = store.approveCustomer(customerId, approvedBy || 'Prakash Paraveen (Admin)');
      if (!approved) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }

      // Persist Approval to PostgreSQL
      try {
        const custRes = await query<{ user_id: string; milk_type: string; daily_quantity: number }>(
          `UPDATE customer_profiles
           SET is_active = true, updated_at = NOW()
           WHERE id = $1
           RETURNING user_id, milk_type, daily_quantity`,
          [customerId]
        );

        if (custRes.rows.length > 0) {
          const userId = custRes.rows[0].user_id;
          await query(`UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`, [userId]);
          await query(`UPDATE subscriptions SET status = 'ACTIVE', updated_at = NOW() WHERE customer_id = $1`, [customerId]);

          const todayStr = new Date().toISOString().split('T')[0];
          const prodPrice = 50.0;
          await query(
            `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EXPECTED')
             ON CONFLICT (customer_id, date, product_id) DO NOTHING`,
            [
              `del_${todayStr}_${customerId}`,
              store.tenantId,
              customerId,
              store.farmer.id,
              custRes.rows[0].milk_type || 'prod_cow_milk',
              todayStr,
              parseFloat(String(custRes.rows[0].daily_quantity)) || 1.0,
              parseFloat(String(custRes.rows[0].daily_quantity)) || 1.0,
              prodPrice,
            ]
          );
        }
      } catch (dbErr) {
        console.warn('[Customer API PATCH Approve] DB update warning:', dbErr);
      }

      return NextResponse.json({
        success: true,
        message: `Client ${approved.name} has been approved and activated!`,
        customer: approved,
      });
    }

    // 2. GENERAL UPDATE ACTION
    const updated = store.updateCustomer(customerId, {
      name,
      email,
      phone,
      address,
      deliveryTime,
      deliveryShift,
      deliverySequence: deliverySequence ? parseInt(String(deliverySequence), 10) : undefined,
      notes,
      productId,
      quantity: quantity !== undefined ? parseFloat(String(quantity)) : undefined,
      customPrice: customPrice !== undefined ? (customPrice === null ? undefined : parseFloat(String(customPrice))) : undefined,
      status,
    });

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    // Persist customer updates to DB
    try {
      if (quantity !== undefined || address !== undefined) {
        await query(
          `UPDATE customer_profiles
           SET daily_quantity = COALESCE($1, daily_quantity),
               delivery_address = COALESCE($2, delivery_address),
               updated_at = NOW()
           WHERE id = $3`,
          [quantity !== undefined ? parseFloat(String(quantity)) : null, address || null, customerId]
        );
      }
      if (status !== undefined) {
        const isActive = status === 'ACTIVE';
        await query(`UPDATE customer_profiles SET is_active = $1, updated_at = NOW() WHERE id = $2`, [isActive, customerId]);
        await query(
          `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = (SELECT user_id FROM customer_profiles WHERE id = $2)`,
          [isActive, customerId]
        );
      }
    } catch (dbErr) {
      console.warn('[Customer API PATCH] DB update warning:', dbErr);
    }

    return NextResponse.json({
      success: true,
      message: `Client ${updated.name} (${updated.customerCode}) updated successfully.`,
      customer: updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update customer';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
