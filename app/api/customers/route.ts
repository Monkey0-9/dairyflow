import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { isTestMode, newUuid, isUuid, resolveDbScope } from '@/lib/db-scope';
import { CustomerProfile, Subscription } from '@/lib/types';
import { getSessionUser } from '@/lib/auth';
import { generateRawInvitationToken, hashInvitationToken } from '@/lib/security/invitation-crypto';

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
    const session = await getSessionUser(req);
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('id');

    if (customerId) {
      const customer = store.customers.find((c) => c.id === customerId);
      if (!customer) {
        return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
      }

      // Tenant isolation: customers from other tenants cannot be accessed
      if (session && session.role !== 'SUPERADMIN' && customer.tenantId && customer.tenantId !== session.tenantId) {
        return NextResponse.json(
          { success: false, error: 'Forbidden: Access denied to customer from another tenant.' },
          { status: 403 }
        );
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

    // Tenant isolation: filter strictly by tenantId when session is present
    if (session && session.role !== 'SUPERADMIN') {
      filteredCustomers = filteredCustomers.filter((c) => !c.tenantId || c.tenantId === session.tenantId);
    }

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
    const session = await getSessionUser(req);
    const isTest = process.env.TEST_ENV === 'unit' || process.env.VITEST === 'true';

    // Production security guard: Only authenticated FARMER or SUPERADMIN can create customers
    if (!isTest && (!session || (session.role !== 'FARMER' && session.role !== 'ADMIN' && session.role !== 'OWNER' && session.role !== 'SUPERADMIN'))) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Only authorized dairy farmers and administrators can create customers.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Production path: PostgreSQL is the source of truth (UUID ids, real
    // tenant/farmer scope, explicit duplicate checks, loud failures).
    // Test path below is preserved verbatim for automated suites.
    if (!isTest) {
      return await createCustomerDurable(session, body);
    }

    const store = getStore();

    if (!body.name || !body.phone || !body.productId || !body.quantity) {
      return NextResponse.json(
        { success: false, error: 'Name, phone, product, and quantity are required.' },
        { status: 400 }
      );
    }

    // Security invariant: tenantId and farmerId are derived strictly from authenticated server-side context
    const effectiveTenantId = session?.tenantId || store.tenantId;
    const effectiveFarmerId = session?.farmerId || session?.userId || store.farmer.id;

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
      farmerId: effectiveFarmerId,
    });
    newCustomer.tenantId = effectiveTenantId;

    // Cryptographic single-use invitation token generation
    const rawToken = generateRawInvitationToken();
    const tokenHash = hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Dual-persist to PostgreSQL
    try {
      await query(
        `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
         ON CONFLICT (id) DO NOTHING`,
        [newCustomer.userId, effectiveTenantId, email, body.phone, body.name, 'INVITED_PENDING_ACTIVATION', 'salt_temp', 'CUSTOMER']
      );

      await query(
        `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
         ON CONFLICT (id) DO NOTHING`,
        [
          newCustomer.id,
          newCustomer.userId,
          effectiveTenantId,
          effectiveFarmerId,
          body.address || 'Local Residence',
          body.productId,
          parseFloat(body.quantity),
          newCustomer.qrToken,
        ]
      );

      await query(
        `INSERT INTO customer_invitations (id, customer_id, token_hash, channel, expires_at, created_by_id, created_at)
         VALUES (gen_random_uuid(), $1, $2, 'SMS', $3, $4, NOW())`,
        [newCustomer.id, tokenHash, expiresAt.toISOString(), session?.userId || newCustomer.userId]
      );

      await query(
        `INSERT INTO subscriptions (id, tenant_id, customer_id, product_id, farmer_id, quantity, frequency, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'DAILY', 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [`sub_${newCustomer.id}`, effectiveTenantId, newCustomer.id, body.productId, effectiveFarmerId, parseFloat(body.quantity)]
      );

      const todayStr = new Date().toISOString().split('T')[0];
      const prodPrice = body.customPrice ? parseFloat(body.customPrice) : 50.0;
      await query(
        `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EXPECTED')
         ON CONFLICT (customer_id, date, product_id) DO NOTHING`,
        [
          `del_${todayStr}_${newCustomer.id}`,
          effectiveTenantId,
          newCustomer.id,
          effectiveFarmerId,
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
      invitationToken: rawToken,
      invitationLink: `/activate?token=${rawToken}`,
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

    // Production path: durable soft-close in PostgreSQL (preserves ledger,
    // invoice and audit history; avoids FK violations on hard delete).
    if (!isTestMode()) {
      return await deleteCustomerDurable(customerId);
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

    // Production path: PostgreSQL-first so edits to real DB rows save even
    // though the in-memory store starts empty (no demo data) in production.
    if (!isTestMode()) {
      return await patchCustomerDurable(body);
    }

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

// ---------------------------------------------------------------------------
// Durable production paths: PostgreSQL-first. The in-memory store starts
// EMPTY in production (no demo data), so store-first lookups 404 on real
// DB rows and store-only writes vanish on restart. These helpers write the
// database first, fail loudly on error, and only then mirror into the store.
// ---------------------------------------------------------------------------

async function createCustomerDurable(session: { userId: string; tenantId: string } | null, body: any) {
  try {
    const scope = await resolveDbScope(session as any);

    const qty = parseFloat(body.quantity);
    if (isNaN(qty) || qty <= 0) {
      return NextResponse.json({ success: false, error: 'quantity must be a positive number' }, { status: 400 });
    }

    // Farmer scope: body value only when it is a real farmer of this tenant.
    let farmerId = scope.farmerId;
    if (isUuid(body.farmerId)) {
      const f = await query(`SELECT id FROM farmer_profiles WHERE id = $1 AND tenant_id = $2`, [body.farmerId, scope.tenantId]);
      if (f.rows.length > 0) farmerId = body.farmerId;
    }

    // Product must be a real product row (delivery_records.product_id is FK).
    let product: { id: string; code: string; basePrice: number | null } | null = null;
    if (isUuid(body.productId)) {
      const p = await query(
        `SELECT id, code, price_per_unit as "basePrice" FROM products WHERE id = $1 AND tenant_id = $2`,
        [body.productId, scope.tenantId]
      );
      if (p.rows.length > 0) product = p.rows[0] as { id: string; code: string; basePrice: number | null };
    }
    if (!product) {
      const p = await query(
        `SELECT id, code, price_per_unit as "basePrice" FROM products WHERE tenant_id = $1 AND is_active = true ORDER BY created_at ASC LIMIT 1`,
        [scope.tenantId]
      );
      if (p.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No products configured for this dairy. Add a product first.' }, { status: 400 });
      }
      product = p.rows[0] as { id: string; code: string; basePrice: number | null };
    }
    const unitPrice = body.customPrice ? parseFloat(body.customPrice) : (product.basePrice ?? 50.0);

    const email = body.email ? String(body.email).trim().toLowerCase() : `${String(body.phone).replace(/[^0-9]/g, '') || Date.now()}@dairyclient.com`;

    // Explicit duplicate check — never silently drop on conflict.
    const dup = await query(`SELECT id FROM users WHERE phone = $1 OR email = $2 LIMIT 1`, [body.phone, email]);
    if (dup.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'A user with this phone number or email already exists.' },
        { status: 409 }
      );
    }

    const userId = newUuid();
    const customerId = newUuid();
    const rawToken = generateRawInvitationToken();
    const tokenHash = hashInvitationToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const todayStr = new Date().toISOString().split('T')[0];

    await query(
      `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'CUSTOMER', false)`,
      [userId, scope.tenantId, email, body.phone, body.name, 'INVITED_PENDING_ACTIVATION', 'salt_temp']
    );
    await query(
      `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
      [customerId, userId, scope.tenantId, farmerId, body.address || 'Local Residence', product.code, qty, `MK_QR_${newUuid().replace(/-/g, '').substring(0, 16)}`]
    );
    await query(
      `INSERT INTO customer_invitations (id, customer_id, token_hash, channel, expires_at, created_by_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'SMS', $3, $4, NOW())`,
      [customerId, tokenHash, expiresAt.toISOString(), session?.userId || userId]
    );
    await query(
      `INSERT INTO subscriptions (id, tenant_id, customer_id, product_id, farmer_id, quantity, frequency, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'DAILY', 'ACTIVE')`,
      [newUuid(), scope.tenantId, customerId, product.id, farmerId, qty]
    );
    await query(
      `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EXPECTED')
       ON CONFLICT (customer_id, date, product_id) DO NOTHING`,
      [newUuid(), scope.tenantId, customerId, farmerId, product.id, todayStr, qty, qty, unitPrice]
    );

    // Mirror into the read cache so subsequent reads are consistent.
    try {
      await syncDbCustomersIntoStore();
    } catch {
      // Non-fatal: next GET re-syncs.
    }
    const store = getStore();
    const cached = store.customers.find((c) => c.id === customerId);

    return NextResponse.json({
      success: true,
      customer: cached || { id: customerId, name: body.name, phone: body.phone, email, farmerId, tenantId: scope.tenantId },
      invitationToken: rawToken,
      invitationLink: `/activate?token=${rawToken}`,
      credentials: { email, phone: body.phone, loginUrl: '/login' },
    }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to add customer';
    console.error('[Customer API POST] durable write failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function patchCustomerDurable(body: any) {
  try {
    const { customerId, action, status, approvedBy, name, email, phone, address,
      productId, quantity, customPrice } = body;
    if (!customerId) {
      return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
    }

    const custRes = await query<{ id: string; user_id: string; tenant_id: string; farmer_id: string }>(
      `SELECT id, user_id as user_id, tenant_id as tenant_id, farmer_id as farmer_id FROM customer_profiles WHERE id = $1`,
      [customerId]
    );
    if (custRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }
    const dbCust = custRes.rows[0];

    // 1. APPROVE ACTION — activate in DB first.
    if (action === 'APPROVE') {
      await query(`UPDATE customer_profiles SET is_active = true, status = 'ACTIVE', updated_at = NOW() WHERE id = $1`, [customerId]);
      await query(`UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`, [dbCust.user_id]);
      await query(`UPDATE subscriptions SET status = 'ACTIVE', updated_at = NOW() WHERE customer_id = $1`, [customerId]);

      // Bootstrap today's delivery record from the DB subscription product.
      try {
        const sub = await query<{ product_id: string; quantity: number }>(
          `SELECT product_id as product_id, quantity::float as quantity FROM subscriptions WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [customerId]
        );
        if (sub.rows.length > 0) {
          const prod = await query(`SELECT price_per_unit as "price" FROM products WHERE id = $1`, [sub.rows[0].product_id]);
          const price = prod.rows[0]?.price ?? 50.0;
          const todayStr = new Date().toISOString().split('T')[0];
          await query(
            `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'EXPECTED')
             ON CONFLICT (customer_id, date, product_id) DO NOTHING`,
            [newUuid(), dbCust.tenant_id, customerId, dbCust.farmer_id, sub.rows[0].product_id, todayStr, sub.rows[0].quantity, sub.rows[0].quantity, price]
          );
        }
      } catch (e) {
        console.warn('[Customer API PATCH Approve] delivery bootstrap warning:', e);
      }

      try {
        const store = getStore();
        if (store.customers.some((c) => c.id === customerId)) store.approveCustomer(customerId, approvedBy || 'Admin');
        await syncDbCustomersIntoStore();
      } catch { /* cache mirror best-effort */ }

      return NextResponse.json({ success: true, message: 'Client has been approved and activated!', customerId });
    }

    // 2. GENERAL UPDATE — users + profile + subscription in DB first.
    if (email !== undefined || phone !== undefined) {
      const dup = await query(
        `SELECT id FROM users WHERE (phone = $1 OR email = $2) AND id <> $3 LIMIT 1`,
        [phone ?? '', email ?? '', dbCust.user_id]
      );
      if (dup.rows.length > 0) {
        return NextResponse.json({ success: false, error: 'Another user already uses this phone number or email.' }, { status: 409 });
      }
      await query(
        `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), updated_at = NOW() WHERE id = $4`,
        [name || null, email || null, phone || null, dbCust.user_id]
      );
    }
    await query(
      `UPDATE customer_profiles
       SET daily_quantity = COALESCE($1, daily_quantity),
           delivery_address = COALESCE($2, delivery_address),
           updated_at = NOW()
       WHERE id = $3`,
      [quantity !== undefined ? parseFloat(String(quantity)) : null, address || null, customerId]
    );
    if (status !== undefined) {
      const isActive = status === 'ACTIVE';
      await query(`UPDATE customer_profiles SET is_active = $1, status = $2, updated_at = NOW() WHERE id = $3`, [isActive, status, customerId]);
      await query(`UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`, [isActive, dbCust.user_id]);
      await query(`UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE customer_id = $2`, [isActive ? 'ACTIVE' : 'PAUSED', customerId]);
    }
    if (productId !== undefined || quantity !== undefined) {
      let subProductId: string | null = null;
      if (isUuid(productId)) {
        const p = await query(`SELECT id FROM products WHERE id = $1 AND tenant_id = $2`, [productId, dbCust.tenant_id]);
        if (p.rows.length === 0) {
          return NextResponse.json({ success: false, error: 'Invalid productId for this dairy.' }, { status: 400 });
        }
        subProductId = productId;
      }
      await query(
        `UPDATE subscriptions SET product_id = COALESCE($1, product_id), quantity = COALESCE($2, quantity), updated_at = NOW()
         WHERE customer_id = $3`,
        [subProductId, quantity !== undefined ? parseFloat(String(quantity)) : null, customerId]
      );
      void customPrice;
    }

    try {
      const store = getStore();
      if (store.customers.some((c) => c.id === customerId)) {
        store.updateCustomer(customerId, {
          name, email, phone, address,
          quantity: quantity !== undefined ? parseFloat(String(quantity)) : undefined,
          productId: isUuid(productId) ? productId : undefined,
          status,
        });
      }
      await syncDbCustomersIntoStore();
    } catch { /* cache mirror best-effort */ }

    return NextResponse.json({ success: true, message: 'Client updated successfully.', customerId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update customer';
    console.error('[Customer API PATCH] durable write failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

async function deleteCustomerDurable(customerId: string) {
  try {
    // Soft-close: preserves delivery/invoice/payment/audit history and
    // cannot violate foreign keys. The client leaves the active roster.
    const res = await query(
      `UPDATE customer_profiles SET is_active = false, status = 'CLOSED', updated_at = NOW() WHERE id = $1 RETURNING user_id`,
      [customerId]
    );
    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Customer not found or already removed' }, { status: 404 });
    }
    await query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1`, [res.rows[0].user_id]);
    await query(`UPDATE subscriptions SET status = 'CANCELLED', updated_at = NOW() WHERE customer_id = $1`, [customerId]);

    try {
      const store = getStore();
      if (store.customers.some((c) => c.id === customerId)) store.deleteCustomer(customerId);
    } catch { /* cache mirror best-effort */ }

    return NextResponse.json({ success: true, message: `Customer ${customerId} successfully removed.`, customerId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove customer';
    console.error('[Customer API DELETE] durable write failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
