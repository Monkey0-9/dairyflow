// Seed Script for MilkFlow: Populates authoritative PostgreSQL database
import { transaction } from '../lib/db';
import { hashPassword } from '../lib/auth';
import crypto from 'crypto';

function computeSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function seed() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    console.error('❌ CRITICAL PROTECTION: prisma/seed.ts cannot be executed in production environment (NODE_ENV=production). Aborting.');
    process.exit(1);
  }

  console.log('🌱 Starting MilkFlow database seeding on Neon PostgreSQL (development environment)...');

  await transaction(async (client) => {
    // Clean up existing data in reverse order of foreign keys
    await client.query('TRUNCATE TABLE audit_blocks, activity_events, notifications, qr_identities, day_closings, inventory_records, payments, invoice_items, invoices, disputes, quantity_change_requests, extra_milk_requests, pause_requests, delivery_records, subscriptions, products, customer_profiles, farmer_profiles, users, tenants CASCADE;');

    console.log('🧹 Cleaned existing tables.');

    // 1. Tenants
    const tenantGreenValley = {
      id: 'tenant_greenvalley',
      name: 'GreenValley Dairy Farm',
      slug: 'greenvalley',
      contactEmail: 'contact@greenvalleydairy.in',
      contactPhone: '+919876543210',
    };

    const tenantSunrise = {
      id: 'tenant_sunrise',
      name: 'Sunrise Dairy Farm',
      slug: 'sunrise',
      contactEmail: 'contact@sunrisedairy.in',
      contactPhone: '+919876543211',
    };

    await client.query(
      `INSERT INTO tenants (id, name, slug, contact_email, contact_phone) VALUES
       ($1, $2, $3, $4, $5),
       ($6, $7, $8, $9, $10);`,
      [
        tenantGreenValley.id, tenantGreenValley.name, tenantGreenValley.slug, tenantGreenValley.contactEmail, tenantGreenValley.contactPhone,
        tenantSunrise.id, tenantSunrise.name, tenantSunrise.slug, tenantSunrise.contactEmail, tenantSunrise.contactPhone,
      ]
    );

    // 2. Users with Salted Password Hashes
    const superAdminPwd = hashPassword('SuperAdmin@2026!');
    const farmerSureshPwd = hashPassword('Farmer@2026!');
    const customerRaviPwd = hashPassword('Customer@2026!');
    const customerPriyaPwd = hashPassword('Customer@2026!');
    const customerAnandPwd = hashPassword('Customer@2026!');
    const farmerRahulPwd = hashPassword('Farmer@2026!');
    const customerSnehaPwd = hashPassword('Customer@2026!');

    const users = [
      {
        id: 'user_admin',
        tenantId: tenantGreenValley.id,
        email: 'admin@milkflow.in',
        phone: '+910000000000',
        name: 'Platform SuperAdmin',
        role: 'SUPERADMIN',
        hash: superAdminPwd.hash,
        salt: superAdminPwd.salt,
      },
      {
        id: 'user_farmer',
        tenantId: tenantGreenValley.id,
        email: 'suresh@greenvalleydairy.in',
        phone: '+919876543210',
        name: 'Suresh Patel',
        role: 'FARMER',
        hash: farmerSureshPwd.hash,
        salt: farmerSureshPwd.salt,
      },
      {
        id: 'user_ravi',
        tenantId: tenantGreenValley.id,
        email: 'ravi.kumar@gmail.com',
        phone: '+919123456780',
        name: 'Ravi Kumar',
        role: 'CUSTOMER',
        hash: customerRaviPwd.hash,
        salt: customerRaviPwd.salt,
      },
      {
        id: 'user_priya',
        tenantId: tenantGreenValley.id,
        email: 'priya.sharma@outlook.com',
        phone: '+919123456781',
        name: 'Priya Sharma',
        role: 'CUSTOMER',
        hash: customerPriyaPwd.hash,
        salt: customerPriyaPwd.salt,
      },
      {
        id: 'user_anand',
        tenantId: tenantGreenValley.id,
        email: 'anand.verma@gmail.com',
        phone: '+919123456782',
        name: 'Anand Verma',
        role: 'CUSTOMER',
        hash: customerAnandPwd.hash,
        salt: customerAnandPwd.salt,
      },
      {
        id: 'user_rahul',
        tenantId: tenantSunrise.id,
        email: 'rahul@sunrisedairy.in',
        phone: '+919876543211',
        name: 'Rahul Deshmukh',
        role: 'FARMER',
        hash: farmerRahulPwd.hash,
        salt: farmerRahulPwd.salt,
      },
      {
        id: 'user_sneha',
        tenantId: tenantSunrise.id,
        email: 'sneha.patil@gmail.com',
        phone: '+919123456783',
        name: 'Sneha Patil',
        role: 'CUSTOMER',
        hash: customerSnehaPwd.hash,
        salt: customerSnehaPwd.salt,
      },
    ];

    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [u.id, u.tenantId, u.email, u.phone, u.name, u.hash, u.salt, u.role]
      );
    }

    // 3. Farmer Profiles
    await client.query(
      `INSERT INTO farmer_profiles (id, user_id, tenant_id, business_name, upi_id, address, route_code)
       VALUES
       ('F001', 'user_farmer', 'tenant_greenvalley', 'GreenValley Organics', 'suresh@oksbi', 'Plot 12, Milk Colony, Pune', 'NORTH-1'),
       ('F002', 'user_rahul', 'tenant_sunrise', 'Sunrise Pure Dairy', 'rahul@okaxis', 'Farm 45, Sunrise Nagar, Nashik', 'EAST-1');`
    );

    // 4. Customer Profiles (Belonging to specific farmers!)
    const customers = [
      {
        id: 'cust_ravi',
        userId: 'user_ravi',
        tenantId: 'tenant_greenvalley',
        farmerId: 'F001',
        address: 'B-204, Shanti Heights, Pune',
        milkType: 'Cow',
        dailyQty: 1.0,
        qrToken: 'QR_OPQ_RAVI_001',
      },
      {
        id: 'cust_priya',
        userId: 'user_priya',
        tenantId: 'tenant_greenvalley',
        farmerId: 'F001',
        address: 'Flat 101, Palm Meadows, Pune',
        milkType: 'Buffalo',
        dailyQty: 1.5,
        qrToken: 'QR_OPQ_PRIYA_002',
      },
      {
        id: 'cust_anand',
        userId: 'user_anand',
        tenantId: 'tenant_greenvalley',
        farmerId: 'F001',
        address: 'A-502, Green Acres, Pune',
        milkType: 'A2',
        dailyQty: 2.0,
        qrToken: 'QR_OPQ_ANAND_003',
      },
      {
        id: 'cust_sneha',
        userId: 'user_sneha',
        tenantId: 'tenant_sunrise',
        farmerId: 'F002',
        address: 'Rowhouse 7, Sunrise Villas, Nashik',
        milkType: 'Cow',
        dailyQty: 1.0,
        qrToken: 'QR_OPQ_SNEHA_004',
      },
    ];

    for (const c of customers) {
      await client.query(
        `INSERT INTO customer_profiles (id, user_id, tenant_id, farmer_id, delivery_address, milk_type, daily_quantity, qr_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [c.id, c.userId, c.tenantId, c.farmerId, c.address, c.milkType, c.dailyQty, c.qrToken]
      );
      // QR Identity
      await client.query(
        `INSERT INTO qr_identities (id, customer_id, token, status)
         VALUES ($1, $2, $3, 'ACTIVE');`,
        [`QR-${c.id}`, c.id, c.qrToken]
      );
    }

    // 5. Products
    const products = [
      { id: 'PROD_COW_GV', tenantId: 'tenant_greenvalley', name: 'Farm Fresh Cow Milk', code: 'COW', price: 50.0 },
      { id: 'PROD_BUF_GV', tenantId: 'tenant_greenvalley', name: 'Creamy Buffalo Milk', code: 'BUFFALO', price: 65.0 },
      { id: 'PROD_A2_GV', tenantId: 'tenant_greenvalley', name: 'Desi Gir Cow A2 Milk', code: 'A2', price: 80.0 },
      { id: 'PROD_COW_SR', tenantId: 'tenant_sunrise', name: 'Sunrise Fresh Cow Milk', code: 'COW', price: 52.0 },
    ];

    for (const p of products) {
      await client.query(
        `INSERT INTO products (id, tenant_id, name, code, price_per_unit)
         VALUES ($1, $2, $3, $4, $5);`,
        [p.id, p.tenantId, p.name, p.code, p.price]
      );
    }

    // 6. Subscriptions
    await client.query(
      `INSERT INTO subscriptions (id, tenant_id, customer_id, product_id, farmer_id, quantity, frequency, status)
       VALUES
       ('SUB_RAVI', 'tenant_greenvalley', 'cust_ravi', 'PROD_COW_GV', 'F001', 1.0, 'DAILY', 'ACTIVE'),
       ('SUB_PRIYA', 'tenant_greenvalley', 'cust_priya', 'PROD_BUF_GV', 'F001', 1.5, 'DAILY', 'ACTIVE'),
       ('SUB_ANAND', 'tenant_greenvalley', 'cust_anand', 'PROD_A2_GV', 'F001', 2.0, 'DAILY', 'ACTIVE'),
       ('SUB_SNEHA', 'tenant_sunrise', 'cust_sneha', 'PROD_COW_SR', 'F002', 1.0, 'DAILY', 'ACTIVE');`
    );

    // 7. Deliveries for September 2026 (Dates 1 to 17 delivered, 18 to 30 expected)
    console.log('📦 Seeding September 2026 Delivery Ledger...');
    for (let day = 1; day <= 30; day++) {
      const dateStr = `2026-09-${String(day).padStart(2, '0')}`;
      const isPastOrToday = day <= 17;

      // Ravi (1L Cow @ 50)
      const raviStatus = isPastOrToday ? 'DELIVERED' : 'EXPECTED';
      const raviDelivered = isPastOrToday ? 1.0 : 0.0;
      await client.query(
        `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status, delivered_at)
         VALUES ($1, 'tenant_greenvalley', 'cust_ravi', 'F001', 'PROD_COW_GV', $2, 1.0, $3, 50.0, $4, $5);`,
        [`DEL_RAVI_${day}`, dateStr, raviDelivered, raviStatus, isPastOrToday ? new Date(`2026-09-${String(day).padStart(2, '0')}T06:30:00Z`) : null]
      );

      // Priya (1.5L Buffalo @ 65)
      // Suppose on day 10 Priya was SKIPPED
      let priyaStatus = isPastOrToday ? 'DELIVERED' : 'EXPECTED';
      let priyaDelivered = isPastOrToday ? 1.5 : 0.0;
      if (day === 10) {
        priyaStatus = 'SKIPPED';
        priyaDelivered = 0.0;
      }
      await client.query(
        `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status, delivered_at)
         VALUES ($1, 'tenant_greenvalley', 'cust_priya', 'F001', 'PROD_BUF_GV', $2, 1.5, $3, 65.0, $4, $5);`,
        [`DEL_PRIYA_${day}`, dateStr, priyaDelivered, priyaStatus, isPastOrToday && day !== 10 ? new Date(`2026-09-${String(day).padStart(2, '0')}T06:45:00Z`) : null]
      );

      // Anand (2.0L A2 @ 80)
      // Suppose on day 14 Anand had PARTIAL delivery (1.0L delivered instead of 2.0L)
      let anandStatus = isPastOrToday ? 'DELIVERED' : 'EXPECTED';
      let anandDelivered = isPastOrToday ? 2.0 : 0.0;
      if (day === 14) {
        anandStatus = 'PARTIAL';
        anandDelivered = 1.0;
      }
      await client.query(
        `INSERT INTO delivery_records (id, tenant_id, customer_id, farmer_id, product_id, date, scheduled_quantity, delivered_quantity, price_per_unit, status, delivered_at)
         VALUES ($1, 'tenant_greenvalley', 'cust_anand', 'F001', 'PROD_A2_GV', $2, 2.0, $3, 80.0, $4, $5);`,
        [`DEL_ANAND_${day}`, dateStr, anandDelivered, anandStatus, isPastOrToday ? new Date(`2026-09-${String(day).padStart(2, '0')}T07:00:00Z`) : null]
      );
    }

    // 8. Requests
    // Priya Vacation request (Sept 20 to Sept 25)
    await client.query(
      `INSERT INTO pause_requests (id, tenant_id, customer_id, farmer_id, start_date, end_date, reason, status)
       VALUES ('REQ_P001', 'tenant_greenvalley', 'cust_priya', 'F001', '2026-09-20', '2026-09-25', 'Family visiting out of town', 'PENDING');`
    );

    // Ravi Extra milk request (Sept 18, 1L)
    await client.query(
      `INSERT INTO extra_milk_requests (id, tenant_id, customer_id, farmer_id, date, milk_type, quantity, notes, status)
       VALUES ('REQ_E001', 'tenant_greenvalley', 'cust_ravi', 'F001', '2026-09-18', 'Cow', 1.0, 'Guest arriving for tea', 'PENDING');`
    );

    // Anand Quantity Change request (effective Sept 22, to 2.5L)
    await client.query(
      `INSERT INTO quantity_change_requests (id, tenant_id, customer_id, farmer_id, effective_date, new_quantity, reason, status)
       VALUES ('REQ_Q001', 'tenant_greenvalley', 'cust_anand', 'F001', '2026-09-22', 2.5, 'Children home for holidays', 'PENDING');`
    );

    // 9. Dispute (Anand for Sept 14 partial delivery)
    await client.query(
      `INSERT INTO disputes (id, tenant_id, customer_id, farmer_id, date, issue_type, claimed_quantity, status, customer_notes)
       VALUES ('DISP_001', 'tenant_greenvalley', 'cust_anand', 'F001', '2026-09-14', 'WRONG_QUANTITY', 1.0, 'OPEN', 'Received only 1L of A2 milk instead of subscribed 2L.');`
    );

    // 10. Invoices (August 2026 completed, September 2026 current)
    // Ravi August Invoice: 31 days * 1L * 50 = 1550, fully paid
    await client.query(
      `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
       VALUES ('INV_RAVI_AUG_2026', 'tenant_greenvalley', 'cust_ravi', 'F001', 8, 2026, 31.0, 1550.0, 1550.0, 0.0, 'PAID', '2026-09-05T00:00:00Z');`
    );
    await client.query(
      `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, method, transaction_ref, status)
       VALUES ('PAY_RAVI_AUG', 'tenant_greenvalley', 'INV_RAVI_AUG_2026', 'cust_ravi', 'F001', 1550.0, 'UPI', 'UPI_TXN_RAVI_AUG_1550', 'SUCCESS');`
    );

    // Ravi September Invoice (Current): 30 days * 1L * 50 = 1500, unpaid
    await client.query(
      `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
       VALUES ('INV_RAVI_SEP_2026', 'tenant_greenvalley', 'cust_ravi', 'F001', 9, 2026, 30.0, 1500.0, 0.0, 1500.0, 'UNPAID', '2026-10-05T00:00:00Z');`
    );

    // Priya September Invoice: 30 days - 1 skipped = 29 days * 1.5L = 43.5L * 65 = 2827.50
    await client.query(
      `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
       VALUES ('INV_PRIYA_SEP_2026', 'tenant_greenvalley', 'cust_priya', 'F001', 9, 2026, 43.5, 2827.5, 0.0, 2827.5, 'UNPAID', '2026-10-05T00:00:00Z');`
    );

    // Anand September Invoice
    await client.query(
      `INSERT INTO invoices (id, tenant_id, customer_id, farmer_id, month, year, total_quantity, total_amount, paid_amount, outstanding_amount, status, due_date)
       VALUES ('INV_ANAND_SEP_2026', 'tenant_greenvalley', 'cust_anand', 'F001', 9, 2026, 59.0, 4720.0, 1000.0, 3720.0, 'PARTIALLY_PAID', '2026-10-05T00:00:00Z');`
    );
    await client.query(
      `INSERT INTO payments (id, tenant_id, invoice_id, customer_id, farmer_id, amount, method, transaction_ref, status)
       VALUES ('PAY_ANAND_PARTIAL', 'tenant_greenvalley', 'INV_ANAND_SEP_2026', 'cust_anand', 'F001', 1000.0, 'UPI', 'UPI_TXN_ANAND_SEP_PARTIAL', 'SUCCESS');`
    );

    // 11. Day Closing & Inventory
    await client.query(
      `INSERT INTO day_closings (id, tenant_id, farmer_id, date, status, total_production, total_delivered, total_waste, total_personal, closing_balance, variance, locked_by)
       VALUES ('CLOSE_2026_09_16', 'tenant_greenvalley', 'F001', '2026-09-16', 'FINALIZED', 85.0, 72.0, 2.0, 1.0, 10.0, 0.0, 'Suresh Patel');`
    );

    await client.query(
      `INSERT INTO inventory_records (id, tenant_id, farmer_id, date, product_code, production_quantity, delivered_quantity, waste_quantity, personal_quantity, opening_stock, closing_stock, difference)
       VALUES
       ('INV_REC_COW_16', 'tenant_greenvalley', 'F001', '2026-09-16', 'COW', 50.0, 42.0, 1.0, 1.0, 0.0, 6.0, 0.0),
       ('INV_REC_BUF_16', 'tenant_greenvalley', 'F001', '2026-09-16', 'BUFFALO', 35.0, 30.0, 1.0, 0.0, 0.0, 4.0, 0.0);`
    );

    // 12. Notifications & Activity Events
    await client.query(
      `INSERT INTO notifications (id, tenant_id, user_id, title, message, type, is_read)
       VALUES
       ('NOTIF_001', 'tenant_greenvalley', 'user_farmer', 'New Vacation Request', 'Priya Sharma requested vacation for Sep 20-25', 'INFO', false),
       ('NOTIF_002', 'tenant_greenvalley', 'user_farmer', 'Extra Milk Request', 'Ravi Kumar requested 1.0L extra Cow milk for Sep 18', 'INFO', false),
       ('NOTIF_003', 'tenant_greenvalley', 'user_farmer', 'New Dispute Raised', 'Anand Verma opened a dispute for Sep 14 delivery', 'WARNING', false),
       ('NOTIF_004', 'tenant_greenvalley', 'user_priya', 'Vacation Submitted', 'Your vacation request for Sep 20-25 is pending farmer approval.', 'INFO', true);`
    );

    await client.query(
      `INSERT INTO activity_events (id, tenant_id, actor_id, actor_role, action, description)
       VALUES
       ('ACT_001', 'tenant_greenvalley', 'user_farmer', 'FARMER', 'DAY_CLOSING', 'Day closing finalized for 2026-09-16 with 0L variance'),
       ('ACT_002', 'tenant_greenvalley', 'user_priya', 'CUSTOMER', 'PAUSE_REQUEST', 'Priya Sharma submitted pause request for Sep 20-25'),
       ('ACT_003', 'tenant_greenvalley', 'user_anand', 'CUSTOMER', 'DISPUTE_OPEN', 'Anand Verma opened dispute on delivery Sep 14');`
    );

    // 13. Cryptographic SHA-256 Audit Chain
    const genesisHash = computeSha256(JSON.stringify({ index: 0, msg: 'MilkFlow Genesis Block', tenant: 'tenant_greenvalley' }));
    await client.query(
      `INSERT INTO audit_blocks (id, tenant_id, index, actor_id, actor_role, entity_type, entity_id, action, previous_hash, current_hash)
       VALUES ('BLOCK_0', 'tenant_greenvalley', 0, 'SYSTEM', 'SYSTEM', 'GENESIS', 'GENESIS_0', 'INITIALIZE', '0', $1);`,
      [genesisHash]
    );

    const block1Data = { index: 1, action: 'CREATE_TENANT', prev: genesisHash };
    const block1Hash = computeSha256(JSON.stringify(block1Data));
    await client.query(
      `INSERT INTO audit_blocks (id, tenant_id, index, actor_id, actor_role, entity_type, entity_id, action, previous_hash, current_hash)
       VALUES ('BLOCK_1', 'tenant_greenvalley', 1, 'user_admin', 'SUPERADMIN', 'TENANT', 'tenant_greenvalley', 'CREATE_TENANT', $1, $2);`,
      [genesisHash, block1Hash]
    );

    const block2Data = { index: 2, action: 'FINALIZED_DAY_CLOSING', prev: block1Hash };
    const block2Hash = computeSha256(JSON.stringify(block2Data));
    await client.query(
      `INSERT INTO audit_blocks (id, tenant_id, index, actor_id, actor_role, entity_type, entity_id, action, previous_hash, current_hash)
       VALUES ('BLOCK_2', 'tenant_greenvalley', 2, 'user_farmer', 'FARMER', 'DAY_CLOSING', 'CLOSE_2026_09_16', 'DAY_CLOSING_LOCK', $1, $2);`,
      [block1Hash, block2Hash]
    );

    console.log('✅ Seeding completed successfully!');
  });
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
