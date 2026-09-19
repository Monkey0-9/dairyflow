import 'dotenv/config';
import { query, getPool } from '../lib/db';
import { hashPassword } from '../lib/auth';

async function setupRealAccounts() {
  console.log('🚀 Setting up real admin account & purging demo accounts...');

  const ADMIN_EMAIL = 'prakashparaveen046@gmail.com';
  const ADMIN_PASSWORD = 'Abc@1234';
  const ADMIN_NAME = 'Prakash Paraveen (Admin)';
  const ADMIN_PHONE = '+91 98765 43210';
  const TENANT_ID = 'tenant_greenvalley';

  const { hash, salt } = hashPassword(ADMIN_PASSWORD);

  // 1. Ensure tenant exists
  await query(
    `INSERT INTO tenants (id, name, slug, contact_email, contact_phone, is_active)
     VALUES ($1, 'GreenValley Dairy Farm', 'greenvalleydairy', $2, $3, true)
     ON CONFLICT (id) DO UPDATE SET is_active = true, contact_email = $2, contact_phone = $3;`,
    [TENANT_ID, ADMIN_EMAIL, ADMIN_PHONE]
  );

  // 2. Delete all demo/fake customer records, delivery records, subscriptions
  const cleanupStatements = [
    `DELETE FROM delivery_records;`,
    `DELETE FROM invoice_adjustments;`,
    `DELETE FROM payments;`,
    `DELETE FROM invoices;`,
    `DELETE FROM disputes;`,
    `DELETE FROM pause_requests;`,
    `DELETE FROM extra_milk_requests;`,
    `DELETE FROM quantity_change_requests;`,
    `DELETE FROM subscriptions;`,
    `DELETE FROM day_closings;`,
    `DELETE FROM customer_profiles;`,
    `DELETE FROM users WHERE LOWER(email) != LOWER($1);`,
  ];

  for (const sql of cleanupStatements) {
    try {
      if (sql.includes('$1')) {
        await query(sql, [ADMIN_EMAIL]);
      } else {
        await query(sql);
      }
    } catch (e: any) {
      console.warn(`Warning on cleanup:`, e.message);
    }
  }

  // 3. Upsert Admin User
  const adminUserId = 'user_prakash';
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
    [adminUserId, TENANT_ID, ADMIN_EMAIL, ADMIN_PHONE, ADMIN_NAME, hash, salt]
  );

  // Also ensure by email if id was different
  await query(
    `UPDATE users
     SET password_hash = $1, password_salt = $2, name = $3, role = 'FARMER', is_active = true
     WHERE LOWER(email) = LOWER($4);`,
    [hash, salt, ADMIN_NAME, ADMIN_EMAIL]
  );

  // 4. Ensure Farmer Profile exists linked to this admin user
  await query(
    `INSERT INTO farmer_profiles (id, user_id, tenant_id, business_name, upi_id, address)
     VALUES ('farmer_01', $1, $2, 'GreenValley Dairy Farm', 'prakash@okaxis', 'Plot 42, Anand Dairy Route')
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       business_name = EXCLUDED.business_name;`,
    [adminUserId, TENANT_ID]
  );

  // 5. Ensure core catalog products exist
  await query(`
    INSERT INTO products (id, tenant_id, name, code, unit, price_per_unit, description)
    VALUES 
      ('prod_cow_milk', '${TENANT_ID}', 'Fresh Cow Milk', 'COW_MILK', 'L', 50.00, 'Farm-fresh pure cow milk'),
      ('prod_buffalo_milk', '${TENANT_ID}', 'Rich Buffalo Milk', 'BUF_MILK', 'L', 70.00, 'Rich buffalo milk with 7% fat'),
      ('prod_a2_milk', '${TENANT_ID}', 'Desi Gir Cow A2 Milk', 'A2_MILK', 'L', 85.00, 'Organic Desi Gir Cow A2 Milk')
    ON CONFLICT (tenant_id, code) DO UPDATE SET price_per_unit = EXCLUDED.price_per_unit;
  `);

  console.log('✅ Admin account configured successfully:');
  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Role:     FARMER (Admin)`);
  console.log(`   Status:   Active`);

  const usersCheck = await query('SELECT id, email, phone, name, role, is_active FROM users');
  console.log('\n📊 Current Users in DB:');
  console.table(usersCheck.rows);

  await getPool().end();
}

setupRealAccounts().catch((err) => {
  console.error('❌ Error setting up accounts:', err);
  process.exit(1);
});
