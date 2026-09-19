import 'dotenv/config';
import { query, getPool } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function cleanDatabase() {
  console.log('🧹 Purging all test, demo, and dummy data from Neon PostgreSQL...');

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@milkflow.in';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Abc@1234';
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Dairy Administrator';
  const ADMIN_PHONE = process.env.ADMIN_PHONE || '+91 98765 43210';
  const TENANT_ID = process.env.TENANT_ID || 'tenant_greenvalley';
  const ADMIN_USER_ID = 'user_admin';

  const { hash, salt } = hashPassword(ADMIN_PASSWORD);

  // 1. Transactional and child records
  const cleanupStatements = [
    `DELETE FROM delivery_records;`,
    `DELETE FROM invoice_adjustments;`,
    `DELETE FROM payments;`,
    `DELETE FROM invoices;`,
    `DELETE FROM disputes;`,
    `DELETE FROM pause_requests;`,
    `DELETE FROM extra_milk_requests;`,
    `DELETE FROM quantity_change_requests;`,
    `DELETE FROM customer_invitations;`,
    `DELETE FROM route_stops;`,
    `DELETE FROM subscriptions;`,
    `DELETE FROM day_closings;`,
    `DELETE FROM inventory_records;`,
    `DELETE FROM notifications;`,
    `DELETE FROM activity_events;`,
    `DELETE FROM audit_blocks WHERE entity_type != 'SYSTEM';`,
    `DELETE FROM customer_profiles;`,
    `DELETE FROM users WHERE LOWER(email) != LOWER($1);`,
    `DELETE FROM farmer_profiles WHERE user_id != $1;`,
  ];

  for (const sql of cleanupStatements) {
    try {
      if (sql.includes('$1') && sql.includes('email')) {
        await query(sql, [ADMIN_EMAIL]);
      } else if (sql.includes('$1') && sql.includes('user_id')) {
        await query(sql, [ADMIN_USER_ID]);
      } else {
        await query(sql);
      }
      console.log(`  ✓ Purged: ${sql.trim().replace(';', '')}`);
    } catch (e: any) {
      console.warn(`  ⚠️ Cleanup notice on ${sql.trim()}:`, e.message);
    }
  }

  // 2. Ensure Tenant exists
  await query(
    `INSERT INTO tenants (id, name, slug, contact_email, contact_phone, is_active)
     VALUES ($1, 'GreenValley Dairy Farm', 'greenvalleydairy', $2, $3, true)
     ON CONFLICT (id) DO UPDATE SET is_active = true, contact_email = $2, contact_phone = $3;`,
    [TENANT_ID, ADMIN_EMAIL, ADMIN_PHONE]
  );
  console.log('  ✓ Verified active tenant: GreenValley Dairy Farm');

  // 3. Ensure Primary Admin User exists
  await query(
    `INSERT INTO users (id, tenant_id, email, phone, name, password_hash, password_salt, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'FARMER', true)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       password_salt = EXCLUDED.password_salt,
       role = 'FARMER',
       is_active = true;`,
    [ADMIN_USER_ID, TENANT_ID, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_NAME, hash, salt]
  );
  console.log('  ✓ Verified clean admin account: ' + ADMIN_EMAIL);

  // 4. Ensure Farmer Profile linked to Admin
  await query(
    `INSERT INTO farmer_profiles (id, user_id, tenant_id, business_name, upi_id, address)
     VALUES ('farmer_01', $1, $2, 'GreenValley Dairy Farm', 'prakash@okaxis', 'Plot 42, Anand-Nadiad Highway, Anand, Gujarat 388001')
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       business_name = EXCLUDED.business_name;`,
    [ADMIN_USER_ID, TENANT_ID]
  );
  console.log('  ✓ Verified farmer profile: farmer_01');

  // 5. Ensure Core Product Catalog
  await query(`
    INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, description, is_active)
    VALUES 
      ('prod_cow_milk', '${TENANT_ID}', 'Fresh Cow Milk', 'COW_MILK', 'L', 50.00, 'Farm-fresh pure cow milk', true),
      ('prod_buffalo_milk', '${TENANT_ID}', 'Rich Buffalo Milk', 'BUF_MILK', 'L', 70.00, 'Rich buffalo milk with 7% fat', true),
      ('prod_a2_milk', '${TENANT_ID}', 'Desi Gir Cow A2 Milk', 'A2_MILK', 'L', 85.00, 'Organic Desi Gir Cow A2 Milk', true)
    ON CONFLICT (tenant_id, code) DO UPDATE SET price_per_unit = EXCLUDED.price_per_unit, is_active = true;
  `);
  console.log('  ✓ Verified clean product catalog (Cow, Buffalo, A2)');

  // 6. Verify Counts
  const custCount = await query(`SELECT count(*) FROM customer_profiles`);
  const delCount = await query(`SELECT count(*) FROM delivery_records`);
  const userCount = await query(`SELECT count(*) FROM users`);

  console.log('\n========================================');
  console.log('🎉 DATABASE IS FRESH & CLEAN:');
  console.log(`   Customer count:        ${custCount.rows[0].count}`);
  console.log(`   Delivery records count: ${delCount.rows[0].count}`);
  console.log(`   User count:            ${userCount.rows[0].count} (${ADMIN_EMAIL})`);
  console.log('========================================\n');

  await getPool().end();
}

cleanDatabase().catch((err) => {
  console.error('❌ Clean DB Error:', err);
  process.exit(1);
});
